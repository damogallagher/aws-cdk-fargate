const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const products = [
    {id: 1, name: "Product 1", price: 100},
    {id: 2, name: "Product 2", price: 200},
    {id: 3, name: "Product 3", price: 300},
];

app.get("/health", (req,res ) => {
    res.status(200).send({data: "OK"});
});

app.get("/", (req,res ) => {
    res.status(200).send({data: products});
});

app.listen( PORT, () => {
    console.log(`Listening at port:${PORT}`)
});