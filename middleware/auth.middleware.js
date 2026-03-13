exports.authenticate = (req, res, next) => {
    if(!req.session || !req.session.user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = req.session.user;
    next();
};

exports.authorize = (...roles) => {
    return (req,res, next) => {
        if(!roles.includes(req.user.role)){
            return res.status(403).json({message: "Access forbidden"});      
    };
    next();
    };
};
