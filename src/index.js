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
    // { name: 'a+', func: a },
    // { name: 'b', func: b}
  ],
});

app.use('/api', server);
app.listen(3000);
console.log('Hotaru server running');
