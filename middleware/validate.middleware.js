const validate = (schema) => (req, res, next) => {
    try{
        schema.parse({
            body: req.body,
            params: req.params,
            query: req.query
        });

        next();
    }catch(err){
        const issues = err.issues || err.errors || [];
        return res.status(400).json({message:"Validation error", errors: issues});
    }
};

module.exports = validate;