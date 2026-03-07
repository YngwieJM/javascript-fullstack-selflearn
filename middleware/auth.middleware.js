const jwt = require("jsonwebtoken");

const { jwtSecret } = require("../config/env")

exports.authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({message: "No token provided"});
    }

    const [scheme, token, ...rest] = authHeader.trim().split(/\s+/);

    if(scheme !== "Bearer" || !token || rest.length > 0){
        return res.status(401).json({message:"Malformed authorization header"})
    }

    try{
        const decoded = jwt.verify(token, jwtSecret);

        req.user = decoded; //attach user info to request
        next();
    }catch(err){
        return res.status(401).json({message: "Invalid or expired token"});
    }
};

exports.authorize = (...allowedRoles) => {
    return (req,res, next) => {
        if(!allowedRoles.includes(req.user.role)){
            return res.status(403).json({message:"Access forbidden"});
        }
        next();
    };
};