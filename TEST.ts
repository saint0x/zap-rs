import { ZapServer } from 'zap-rs';

const app = new ZapServer();
app.get('/', (req, res) => {
  res.json({ message: 'Hello from live zap-rs!' });
});

app.listen(3000);