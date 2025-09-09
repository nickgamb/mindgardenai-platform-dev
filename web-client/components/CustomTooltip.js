import React, { useState } from 'react';
import { IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, useMediaQuery } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTheme } from '@mui/material/styles';

const CustomTooltip = ({ content }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton size="small" onClick={handleOpen}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="tooltip-dialog-title"
        aria-describedby="tooltip-dialog-description"
      >
        <DialogTitle id="tooltip-dialog-title">Information</DialogTitle>
        <DialogContent>
          <DialogContentText id="tooltip-dialog-description">
            {content}
          </DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomTooltip;
