import { dev } from 'astro';

try {
  const devServer = await dev({
    root: '.',
    server: {
      host: '127.0.0.1',
      port: 4321,
    },
  });

  console.log(`🚀 Dev server running at http://127.0.0.1:4321`);
} catch (err) {
  console.error('Error starting dev server:', err);
}

// Keep process running
process.stdin.resume();
