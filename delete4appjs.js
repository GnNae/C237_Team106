app.get('/deleteProduct/:id', (req, res) => { 
    const productId = req.params.id; 
    connection.query('DELETE FROM products WHERE petId = ?', [petId], (error, results) => { 

        if (error) { 
            // Handle any error that occurs during the database operation 
            console.error("Error deleting product:", error); 
            res.status(500).send('Error deleting product'); 
        } else { 
            // Send a success response 
            res.redirect('/inventory'); 
        } 
    }); 
}); 