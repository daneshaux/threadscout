import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { triggers } from './routes/triggers';
import { menu } from './routes/menu';

const app = new Hono();
const internal = new Hono();

internal.route('/form', forms);
internal.route('/triggers', triggers);
internal.route('/menu', menu);

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
