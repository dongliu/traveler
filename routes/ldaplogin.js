/**
 * Created by djarosz on 10/13/15.
 */

var auth = require('../lib/auth');

module.exports = function(app){
    app.get('/ldaplogin/', function(req, res) {
        res.render('ldaplogin',{
            prefix: req.proxied ? req.proxied_prefix : ''
        });
    });

    app.post('/ldaplogin/', auth.ensureAuthenticated,function(req,res){
        res.render('ldaplogin',{
            prefix: req.proxied ? req.proxied_prefix : '',
            errorMessage: res.locals.error
        });
        delete res.locals.error;
    });
}

