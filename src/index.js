import express from 'express';
import HotaruServer from './HotaruServer';
import MongoAdapter from './MongoAdapter';


const app = express();

const server = HotaruServer.createServer({
  dbAdapter: new MongoAdapter({
    uri: 'mongodb://localhost:27017/hotaru_dev_01',
    schema: null,
  }),
  cloudFunctions: [
    {
      name: 'hello',
      func: async function (dbAdapter, user, params, installationDetails) {
        return params;
      },
    },
    {
      name: 'world',
      func: async function (dbAdapter, user, params, installationDetails) {

      },
    },
  ],
  debug: true,
});

app.use('/api', server);
app.listen(3000);
console.log('Hotaru server running');
