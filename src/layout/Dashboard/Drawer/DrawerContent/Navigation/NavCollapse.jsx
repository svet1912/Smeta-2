import { useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

// assets
import { DownOutlined, RightOutlined } from '@ant-design/icons';

// project import
import NavItem from './NavItem';
import { useGetMenuMaster } from 'api/menu';

// ==============================|| NAVIGATION - LIST COLLAPSE ||============================== //

export default function NavCollapse({ menu, level }) {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleClick = () => {
    setOpen(!open);
    setSelected(!selected ? menu.id : null);
  };

  // menu collapse & item
  const menus = menu.children?.map((item) => {
    switch (item.type) {
      case 'collapse':
        return <NavCollapse key={item.id} menu={item} level={level + 1} />;
      case 'item':
        return <NavItem key={item.id} item={item} level={level + 1} />;
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Fix - Collapse or Items
          </Typography>
        );
    }
  });

  const Icon = menu.icon;
  const menuIcon = menu.icon ? (
    <Icon style={{ fontSize: drawerOpen ? '1rem' : '1.25rem' }} />
  ) : (
    <div
      style={{
        width: selected === menu.id ? 8 : 6,
        height: selected === menu.id ? 8 : 6,
        borderRadius: '50%',
        backgroundColor: selected === menu.id ? 'primary.main' : 'secondary.dark'
      }}
    />
  );

  return (
    <>
      <ListItemButton
        selected={selected === menu.id}
        onClick={handleClick}
        sx={{
          zIndex: 1201,
          pl: drawerOpen ? `${level * 28}px` : 1.5,
          py: !drawerOpen && level === 1 ? 1.25 : 1,
          ...(drawerOpen && {
            '&:hover': {
              bgcolor: 'primary.lighter'
            },
            '&.Mui-selected': {
              bgcolor: 'primary.lighter',
              borderRight: `2px solid`,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                color: 'primary.main',
                bgcolor: 'primary.lighter'
              }
            }
          }),
          ...(!drawerOpen && {
            '&:hover': {
              bgcolor: 'transparent'
            },
            '&.Mui-selected': {
              '&:hover': {
                bgcolor: 'transparent'
              },
              bgcolor: 'transparent'
            }
          })
        }}
      >
        {menuIcon && (
          <ListItemIcon
            sx={{
              minWidth: 28,
              color: selected === menu.id ? 'primary.main' : 'secondary.dark',
              ...(!drawerOpen && {
                borderRadius: 1.5,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  bgcolor: 'secondary.lighter'
                }
              }),
              ...(!drawerOpen &&
                selected === menu.id && {
                  bgcolor: 'primary.lighter',
                  '&:hover': {
                    bgcolor: 'primary.lighter'
                  }
                })
            }}
          >
            {menuIcon}
          </ListItemIcon>
        )}
        {drawerOpen && (
          <ListItemText
            primary={
              <Typography variant="h6" sx={{ color: selected === menu.id ? 'primary.main' : 'text.primary' }}>
                {menu.title}
              </Typography>
            }
          />
        )}
        {drawerOpen && (open ? <DownOutlined /> : <RightOutlined />)}
      </ListItemButton>
      {drawerOpen && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ position: 'relative' }}>
            {menus}
          </List>
        </Collapse>
      )}
    </>
  );
}

NavCollapse.propTypes = {
  menu: PropTypes.object,
  level: PropTypes.number
};
