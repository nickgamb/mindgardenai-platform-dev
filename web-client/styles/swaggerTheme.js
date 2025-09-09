const createSwaggerTheme = (theme, isMobile) => `
  /* Override the base styles */
  .swagger-ui, 
  .swagger-ui.swagger-ui .scheme-container,
  .swagger-ui.swagger-ui .swagger-ui {
    color: ${theme.palette.text.primary} !important;
    font-family: ${theme.typography.fontFamily} !important;
    font-size: ${isMobile ? '14px' : '16px'} !important;
  }

  /* Override background colors */
  .swagger-ui,
  .swagger-ui .scheme-container,
  .swagger-ui .swagger-ui {
    background: ${theme.palette.background.default} !important;
  }

  /* Style the scheme container */
  .swagger-ui .scheme-container {
    box-shadow: 0 1px 2px 0 ${theme.palette.divider} !important;
    margin: 0 0 ${isMobile ? '10px' : '20px'} !important;
    padding: ${isMobile ? '15px 0' : '30px 0'} !important;
  }

  /* Style buttons */
  .swagger-ui .btn {
    background-color: ${theme.palette.primary.main} !important;
    color: ${theme.palette.primary.contrastText} !important;
    border-color: ${theme.palette.primary.main} !important;
    border-radius: 8px !important;
    padding: ${isMobile ? '8px 16px' : '10px 20px'} !important;
    text-transform: none !important;
    font-weight: 500 !important;
    font-family: ${theme.typography.fontFamily} !important;
    font-size: ${isMobile ? '14px' : '16px'} !important;
  }

  /* Style select inputs */
  .swagger-ui select {
    background-color: ${theme.palette.background.paper} !important;
    color: ${theme.palette.text.primary} !important;
    border: 1px solid ${theme.palette.divider} !important;
    border-radius: 8px !important;
    padding: ${isMobile ? '12px 10px' : '16.5px 14px'} !important;
    font-family: ${theme.typography.fontFamily} !important;
    font-size: ${isMobile ? '14px' : '16px'} !important;
  }

  /* Style text inputs */
  .swagger-ui input[type=text] {
    background-color: ${theme.palette.background.paper} !important;
    color: ${theme.palette.text.primary} !important;
    border: 1px solid ${theme.palette.divider} !important;
    border-radius: 8px !important;
    padding: ${isMobile ? '12px 10px' : '16.5px 14px'} !important;
    font-family: ${theme.typography.fontFamily} !important;
    font-size: ${isMobile ? '14px' : '16px'} !important;
  }

  /* Override text colors for various elements */
  .swagger-ui .opblock .opblock-summary-operation-id,
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path__deprecated,
  .swagger-ui .opblock-tag {
    color: ${theme.palette.text.primary} !important;
    font-size: ${isMobile ? '14px' : '16px'} !important;
  }

  /* Style the models section */
  .swagger-ui .model-box {
    background-color: ${theme.palette.background.paper} !important;
    border-color: ${theme.palette.divider} !important;
  }

  /* Ensure proper contrast for code blocks */
  .swagger-ui .highlight-code {
    background-color: ${theme.palette.background.paper} !important;
    color: ${theme.palette.text.primary} !important;
    font-size: ${isMobile ? '12px' : '14px'} !important;
  }

  /* Adjust spacing for mobile */
  ${isMobile ? `
    .swagger-ui .opblock {
      margin: 0 0 10px;
    }
    .swagger-ui .opblock-tag {
      margin: 10px 0 5px 0;
    }
    .swagger-ui .opblock-tag small {
      font-size: 12px;
    }
  ` : ''}

  /* Style for PermissionsDisplay */
  #permissions-display {
    margin: 20px 0;
    padding: 10px;
    background-color: ${theme.palette.background.paper};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
  }

  /* Style the tag titles */
  .swagger-ui .opblock-tag {
    color: ${theme.palette.primary.main} !important;
    font-size: ${isMobile ? '18px' : '24px'} !important;
    font-weight: 600 !important;
    margin: ${isMobile ? '10px 0 5px 0' : '20px 0 10px 0'} !important;
  }

  .swagger-ui .opblock-tag small {
    color: ${theme.palette.text.secondary} !important;
    font-size: ${isMobile ? '12px' : '14px'} !important;
  }
`;

export default createSwaggerTheme;
