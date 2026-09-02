module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "غير مصرح لك",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
      });
    }

    next();
  };
};