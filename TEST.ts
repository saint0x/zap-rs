import { Zap } from 'zap-rs';

async function main(): Promise<void> {
  console.log('🔥 Starting Zap test on port 8080...');
  const app = new Zap();
  
  // Try port 8080 instead
  await app.port(8080);
  await app.hostname('127.0.0.1');
  
  await app.getJson('/', () => {
    console.log('📥 Request received!');
    return { message: 'Hello from Zap!', port: 8080 };
  });

  console.log('📡 About to start listening...');
  await app.listen();
  console.log('✅ Server should be running on http://127.0.0.1:8080');
  
  // Keep alive
  setInterval(() => {
    process.stdout.write('.');
  }, 1000);
}

main().catch(console.error);