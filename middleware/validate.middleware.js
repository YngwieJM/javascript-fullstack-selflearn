const validate = (schema) => (req, res, next) => {
    try{
        const parsed = schema.parse({
            body: req.body,
            params: req.params,
            query: req.query
        });

        req.validated = parsed;
        req.body = parsed.body ?? req.body;
        req.params = parsed.params ?? req.params;
        req.query = parsed.query ??req.query;

        next();
    }catch(err){
        const issues = err.issues || err.errors || [];
        return res.status(400).json({message:"Validation error", errors: issues});
    }
};

module.exports = validate;
