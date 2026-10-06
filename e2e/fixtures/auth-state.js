const path = require('path');

const AUTH_DIR = path.join(__dirname, '..', '.auth');
const PRIMARY_AUTH_STATE = path.join(AUTH_DIR, 'primary.json');
const SECONDARY_AUTH_STATE = path.join(AUTH_DIR, 'secondary.json');

module.exports = { AUTH_DIR, PRIMARY_AUTH_STATE, SECONDARY_AUTH_STATE };
