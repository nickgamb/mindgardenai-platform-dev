import { AppProvider } from '../contexts/AppContext';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../styles/theme';
import Head from 'next/head';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import GlobalErrorHandler from '../components/GlobalErrorHandler';
import '@mui/icons-material/FiberManualRecord';

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Head>
        <title>MindGarden Research Platform</title>
        <meta name="description" content="MindGarden Research Platform" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>
      <AppProvider>
        <Layout>
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
        </Layout>
      </AppProvider>
    </ThemeProvider>
  );
}

export default MyApp;
