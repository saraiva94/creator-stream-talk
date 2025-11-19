import express from 'express';
import cors from 'cors';
import routes from './src/routes';
import { loadEnv, getEnv } from './src/lib/env';

loadEnv();

const app = express();
const port = Number(getEnv('BACKEND_PORT', '4000'));

app.use(cors());
app.use(express.json());
app.use('/', routes);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
