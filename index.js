require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('server alive');
});

app.get('/webhook', (req, res) => {
  res.send('webhook alive');
});

app.post('/webhook', (req, res) => {
  console.log('Webhook hit');
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('SERVER RUNNING ON', PORT);
});