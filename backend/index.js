import express from 'express';

const app = express();

app.get('/', (req, res) => {
    res.send(' Server properly running!');
});

app.listen(5000, () => {
    console.log(' server 5000 port pr start haiiiiii');
});