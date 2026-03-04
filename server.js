const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

let products = [
    {id: 1, name: "Laptop", price: 1000},
    {id: 2, name: "Mouse", price:50}
];

app.get("/products", (req, res) =>{
    res.json(products);
});

app.get("/products/:id", (req, res) => {
    const id = parseInt(req.params.id);

    const products = products.find(p => p.id === id);

    if(!products){
        return res.status(404).json({message: "Product not found"});
    }

    res.json(products)
});

app.post("/products", (req, res => {
    const {name, price} = req.body;

    id(!name || !price){
        return res.status(400).json({message: "Name and Price are required"});
    }

    const newProduct = {
        id: products.length + 1,
        name,
        price
    };

    products.push(newProduct);

    res.status(201).json(newProduct);
}));

app.put("/products/:id", (req, res => {
    const id = parseInt(req.params.id);
    const {name, price} = req.body;

    const product = products.find(p => p.id === id);

    id(!product){
        return res.status(404).json({meesage: "Product not found"});
    }

        if(name) product.name = name;
        if(price) product.price = price;

        res.json(product);
}));

app.delete("/products/:id", (req, res) => {
    const id = parseInt(req.params.id);

    const index = products.findIndex(p => p.id ===id);

    if(index === -1){
        return res.status(404).json({message: "Product not found"});
    }

    const delted = products.splice(index, 1);

    res.json({message: "Deleted successfully", delted});
});