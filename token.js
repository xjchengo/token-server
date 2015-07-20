var moment = require('moment');
var router = require('express').Router();
var AV = require('leanengine');
var WechatAccount = AV.Object.extend('WechatAccount');

router.get('/token', function(req, res, next) {
  var grantType = req.query.grant_type || 'client_credential';
  var appId = req.query.appid;
  var secret = req.query.secret;
  var force = req.query.force || false;
  var query = new AV.Query(WechatAccount);
  query.equalTo("grantType", grantType);
  query.equalTo("appId", appId);
  query.equalTo("secret", secret);
  query.first({
    success: function(wechatAccount) {
      if (!wechatAccount) {
        res.json({
          errcode: -2,
          errmsg: 'This account isn\'t in WechatAccount class. Please add it manually.'
        });
      }

      var now = moment();
      if (!force
        && wechatAccount.get('expiresAt') 
        && now.isBefore(wechatAccount.get('expiresAt'))
      ) {
        var expiresIn = moment(wechatAccount.get('expiresAt')).diff(now, 's');
        res.json({
          access_token: wechatAccount.get('accessToken'),
          expires_in: expiresIn
        });
      } else {
        AV.Cloud.run('getWechatAccessToken', {
          grantType: grantType,
          appId: appId,
          secret: secret
        }, {
          success: function(result) {
            res.json(result);
          },
          error: function(error) {
            res.json(error);
          }
        });
      }
    },
    error: function(error) {
      console.log(error);
      res.json({
        errcode: -1,
        errmsg: 'If you encounter this error, consult your web admin!'
      });
    }
  });
});

module.exports = router;
