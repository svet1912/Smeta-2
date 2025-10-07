/**
 * SMETA360-2 Deployment Manager
 * Phase 4 Step 1: Blue-Green Deployment Controller
 * 
 * Manages zero-downtime deployments using Blue-Green strategy
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Docker = require('dockerode');
const winston = require('winston');
const Joi = require('joi');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const docker = new Docker();
const PORT = process.env.PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Deployment state
let deploymentState = {
  active: 'blue',
  inactive: 'green',
  deploying: false,
  lastDeployment: null,
  deploymentHistory: []
};

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    deploymentState: deploymentState
  });
});

/**
 * Get Deployment Status
 */
app.get('/api/deployment/status', (req, res) => {
  res.json({
    ...deploymentState,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Start Blue-Green Deployment
 */
app.post('/api/deployment/deploy', async (req, res) => {
  const schema = Joi.object({
    image: Joi.string().required(),
    tag: Joi.string().default('latest'),
    healthCheckPath: Joi.string().default('/api/monitoring/health'),
    healthCheckTimeout: Joi.number().default(300000), // 5 minutes
    rollbackOnFailure: Joi.boolean().default(true)
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  if (deploymentState.deploying) {
    return res.status(409).json({ 
      error: 'Deployment already in progress',
      currentState: deploymentState 
    });
  }

  const deploymentId = `deploy-${Date.now()}`;
  
  try {
    deploymentState.deploying = true;
    deploymentState.currentDeploymentId = deploymentId;

    logger.info('Starting blue-green deployment', { 
      deploymentId,
      image: value.image,
      tag: value.tag,
      from: deploymentState.active,
      to: deploymentState.inactive
    });

    // Start deployment process
    const deployment = await startBlueGreenDeployment(value, deploymentId);
    
    res.json({
      deploymentId,
      status: 'started',
      message: 'Blue-green deployment initiated',
      deployment
    });

  } catch (error) {
    logger.error('Deployment failed to start', { error: error.message, deploymentId });
    deploymentState.deploying = false;
    deploymentState.currentDeploymentId = null;
    
    res.status(500).json({ 
      error: 'Failed to start deployment',
      details: error.message 
    });
  }
});

/**
 * Rollback to Previous Version
 */
app.post('/api/deployment/rollback', async (req, res) => {
  if (deploymentState.deploying) {
    return res.status(409).json({ 
      error: 'Cannot rollback during active deployment' 
    });
  }

  try {
    logger.info('Starting rollback', { 
      from: deploymentState.active,
      to: deploymentState.inactive 
    });

    await switchTraffic();
    
    res.json({
      status: 'success',
      message: 'Rollback completed',
      newActive: deploymentState.active,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Rollback failed', { error: error.message });
    res.status(500).json({ 
      error: 'Rollback failed',
      details: error.message 
    });
  }
});

/**
 * Get Deployment History
 */
app.get('/api/deployment/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const history = deploymentState.deploymentHistory.slice(-limit);
  
  res.json({
    history,
    total: deploymentState.deploymentHistory.length,
    limit
  });
});

/**
 * Blue-Green Deployment Logic
 */
async function startBlueGreenDeployment(config, deploymentId) {
  const targetColor = deploymentState.inactive;
  const targetContainer = `smeta360_app_${targetColor}`;
  
  const deployment = {
    id: deploymentId,
    startTime: new Date().toISOString(),
    status: 'in_progress',
    steps: []
  };

  try {
    // Step 1: Pull new image
    deployment.steps.push({ step: 'pull_image', status: 'started', timestamp: new Date().toISOString() });
    await pullImage(config.image, config.tag);
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    // Step 2: Stop inactive container
    deployment.steps.push({ step: 'stop_inactive_container', status: 'started', timestamp: new Date().toISOString() });
    await stopContainer(targetContainer);
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    // Step 3: Start new container
    deployment.steps.push({ step: 'start_new_container', status: 'started', timestamp: new Date().toISOString() });
    await startNewContainer(targetColor, config.image, config.tag);
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    // Step 4: Health check
    deployment.steps.push({ step: 'health_check', status: 'started', timestamp: new Date().toISOString() });
    await waitForHealthCheck(targetColor, config.healthCheckPath, config.healthCheckTimeout);
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    // Step 5: Switch traffic
    deployment.steps.push({ step: 'switch_traffic', status: 'started', timestamp: new Date().toISOString() });
    await switchTraffic();
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    // Step 6: Cleanup
    deployment.steps.push({ step: 'cleanup', status: 'started', timestamp: new Date().toISOString() });
    await cleanupOldContainer(deploymentState.inactive);
    deployment.steps[deployment.steps.length - 1].status = 'completed';

    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.duration = Date.now() - new Date(deployment.startTime).getTime();

    // Update state
    deploymentState.deploying = false;
    deploymentState.currentDeploymentId = null;
    deploymentState.lastDeployment = deployment;
    deploymentState.deploymentHistory.push(deployment);

    logger.info('Deployment completed successfully', { deploymentId, duration: deployment.duration });
    
    return deployment;

  } catch (error) {
    deployment.status = 'failed';
    deployment.error = error.message;
    deployment.endTime = new Date().toISOString();
    
    deploymentState.deploying = false;
    deploymentState.currentDeploymentId = null;
    deploymentState.deploymentHistory.push(deployment);

    if (config.rollbackOnFailure) {
      logger.info('Rolling back due to deployment failure', { deploymentId });
      await rollbackOnFailure();
    }

    throw error;
  }
}

/**
 * Pull Docker Image
 */
async function pullImage(image, tag) {
  logger.info('Pulling Docker image', { image, tag });
  
  return new Promise((resolve, reject) => {
    docker.pull(`${image}:${tag}`, (err, stream) => {
      if (err) return reject(err);
      
      docker.modem.followProgress(stream, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  });
}

/**
 * Stop Container
 */
async function stopContainer(containerName) {
  logger.info('Stopping container', { containerName });
  
  try {
    const container = docker.getContainer(containerName);
    await container.stop();
    await container.remove();
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info('Container not found, skipping stop', { containerName });
    } else {
      throw error;
    }
  }
}

/**
 * Start New Container
 */
async function startNewContainer(color, image, tag) {
  logger.info('Starting new container', { color, image, tag });
  
  const port = color === 'blue' ? 3001 : 3002;
  const containerName = `smeta360_app_${color}`;
  
  const container = await docker.createContainer({
    name: containerName,
    Image: `${image}:${tag}`,
    Env: [
      'NODE_ENV=production',
      `DEPLOYMENT_COLOR=${color}`,
      `PORT=${port}`,
      `DATABASE_URL=${process.env.DATABASE_URL}`,
      `REDIS_URL=${process.env.REDIS_URL}`,
      `JWT_SECRET=${process.env.JWT_SECRET}`
    ],
    ExposedPorts: {
      [`${port}/tcp`]: {}
    },
    HostConfig: {
      PortBindings: {
        [`${port}/tcp`]: [{ HostPort: port.toString() }]
      },
      RestartPolicy: {
        Name: 'unless-stopped'
      }
    },
    Labels: {
      'deployment.color': color,
      'deployment.active': 'false',
      'service': 'smeta360-app'
    }
  });

  await container.start();
  return container;
}

/**
 * Wait for Health Check
 */
async function waitForHealthCheck(color, healthCheckPath, timeout) {
  logger.info('Waiting for health check', { color, healthCheckPath, timeout });
  
  const port = color === 'blue' ? 3001 : 3002;
  const healthUrl = `http://localhost:${port}${healthCheckPath}`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(healthUrl, { timeout: 5000 });
      if (response.status === 200) {
        logger.info('Health check passed', { color, url: healthUrl });
        return true;
      }
    } catch (error) {
      logger.debug('Health check failed, retrying...', { color, error: error.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error(`Health check timeout after ${timeout}ms for ${color} environment`);
}

/**
 * Switch Traffic (Update Nginx Configuration)
 */
async function switchTraffic() {
  logger.info('Switching traffic', { 
    from: deploymentState.active,
    to: deploymentState.inactive 
  });
  
  // Switch deployment state
  const newActive = deploymentState.inactive;
  const newInactive = deploymentState.active;
  
  deploymentState.active = newActive;
  deploymentState.inactive = newInactive;
  
  // Here you would update nginx configuration or service mesh
  // For now, we'll simulate with container labels
  await updateContainerLabels(newActive, true);
  await updateContainerLabels(newInactive, false);
  
  // Reload nginx configuration
  await reloadNginx();
  
  logger.info('Traffic switched successfully', { 
    newActive: deploymentState.active,
    newInactive: deploymentState.inactive 
  });
}

/**
 * Update Container Labels
 */
async function updateContainerLabels(color, isActive) {
  const containerName = `smeta360_app_${color}`;
  
  try {
    const container = docker.getContainer(containerName);
    const containerInfo = await container.inspect();
    
    // Update labels (this is a simplified approach)
    containerInfo.Config.Labels['deployment.active'] = isActive.toString();
    
  } catch (error) {
    logger.warn('Failed to update container labels', { color, error: error.message });
  }
}

/**
 * Reload Nginx Configuration
 */
async function reloadNginx() {
  try {
    const nginxContainer = docker.getContainer('smeta360_nginx_lb');
    await nginxContainer.exec({
      Cmd: ['nginx', '-s', 'reload'],
      AttachStdout: true,
      AttachStderr: true
    });
    
    logger.info('Nginx configuration reloaded');
  } catch (error) {
    logger.error('Failed to reload nginx', { error: error.message });
    throw error;
  }
}

/**
 * Cleanup Old Container
 */
async function cleanupOldContainer(color) {
  logger.info('Cleaning up old container', { color });
  
  // Keep the old container running for potential rollback
  // In production, you might want to implement a cleanup policy
  logger.info('Old container kept for rollback capability', { color });
}

/**
 * Rollback on Failure
 */
async function rollbackOnFailure() {
  logger.info('Rolling back due to deployment failure');
  
  try {
    // Switch back to previous active
    await switchTraffic();
    logger.info('Rollback completed successfully');
  } catch (error) {
    logger.error('Rollback failed', { error: error.message });
    throw error;
  }
}

/**
 * Scheduled Health Checks
 */
cron.schedule('*/5 * * * *', async () => {
  logger.debug('Running scheduled health checks');
  
  try {
    const activePort = deploymentState.active === 'blue' ? 3001 : 3002;
    const response = await axios.get(`http://localhost:${activePort}/api/monitoring/health`, { timeout: 10000 });
    
    if (response.status !== 200) {
      logger.warn('Active service health check failed', { 
        color: deploymentState.active,
        status: response.status 
      });
    }
  } catch (error) {
    logger.error('Scheduled health check failed', { 
      color: deploymentState.active,
      error: error.message 
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString() 
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Deployment Manager running on port ${PORT}`);
  logger.info('Initial deployment state', deploymentState);
});

module.exports = app;