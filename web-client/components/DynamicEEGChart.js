import dynamic from 'next/dynamic';

const DynamicEEGChart = dynamic(() => import('./EEGChart'), {
  ssr: false,
});

export default DynamicEEGChart;
