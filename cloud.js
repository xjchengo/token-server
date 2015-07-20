var moment = require('moment');
var AV = require('leanengine');
var WechatAccount = AV.Object.extend('WechatAccount');

// 根据 appId 和 secret 获取 access token
AV.Cloud.define('getWechatAccessToken', function(request, response) {
  var grantType = request.params.grantType;
  var appId = request.params.appId;
  var secret = request.params.secret;
  var notListen = request.params.notListen || false;
  var responseHandler = function (data) {
    if (!data.access_token) {
      response.error(data);
    } else {
      response.success(data);
    }
  };
  var query = new AV.Query(WechatAccount);
  query.equalTo("grantType", grantType);
  query.equalTo("appId", appId);
  query.equalTo("secret", secret);
  query.first({
    success: function(wechatAccount) {
      if (!wechatAccount) {
        res.error({
          errcode: -2,
          errmsg: 'This account isn\'t in WechatAccount class. Please add it manually.'
        });
      }

      var listener = function() {
        if (notListen) {
          response.success({});
        }
        var syncAmount = 0;
        function syncWechatAccount() {
          console.log('sync');
          syncAmount = 1;
          wechatAccount.fetch({
            success: function(wechatAccount) {
              if (wechatAccount.get('requesting') == 0) {
                var now = moment();
                var expiresIn = moment(wechatAccount.get('expiresAt')).diff(now, 's');
                response.success({
                  access_token: wechatAccount.get('accessToken'),
                  expires_in: expiresIn
                });
              } else {
                if (syncAmount < 10) {
                  setTimeout(function () {
                    syncWechatAccount();
                  }, 1000);
                } else {
                  response.error({
                    errcode: -3,
                    errmsg: 'Sync failed! Please try agagin'
                  });
                }
                
              }
            },
            error: function(error) {
              console.log(error);
              
            }
          });
        };
        syncWechatAccount();
      };
      var emitter = function() {
        AV.Cloud.httpRequest({
          url: 'https://api.weixin.qq.com/cgi-bin/token?grant_type=' + grantType + '&appid=' + appId + '&secret=' + secret,
          success: function(httpResponse) {
            var data = httpResponse.data;
            if (!data.access_token) {
              response.error(data);
            } else {
              wechatAccount.set('requesting', 0);
              wechatAccount.set('accessToken', data.access_token);
              wechatAccount.set('expiresAt', moment().add(data.expires_in, 's').toDate());
              wechatAccount.save();
              response.success(data);
            }
          },
          error: function(httpResponse) {
            console.log(httpResponse);
            response.error({
              errcode: -1,
              errmsg: 'If you encounter this error, consult your web admin!'
            });
          }
        });
      };

      if (wechatAccount.get('requesting') == 0) {
        wechatAccount.fetchWhenSave(true);
        wechatAccount.increment("requesting");
        wechatAccount.save(null, {
          success: function(wechatAccount) {
            // requesting为1的请求出错了怎么办
            if (wechatAccount.get('requesting') == 1) {
              emitter();
            } else {
              listener();
            }
          },
          error: function(post, error) {
            console.log(error);
            res.error({
              errcode: -1,
              errmsg: 'If you encounter this error, consult your web admin!'
            });
          }
        });
      } else {
        listener();
      }
    },
    error: function(error) {
      console.log(error);
      res.error({
        errcode: -1,
        errmsg: 'If you encounter this error, consult your web admin!'
      });
    }
  });
});

AV.Cloud.define('refreshWechatAccessToken', function(request, response) {
  var query = new AV.Query(WechatAccount);
  query.find({
    success: function(wechatAccounts) {
      // 处理返回的结果数据
      for (var i = 0; i < wechatAccounts.length; i++) {
        var wechatAccount = wechatAccounts[i];
        var now = moment();
        var expiresAt = moment(wechatAccount.get('expiresAt'));
        var diff = expiresAt.diff(now, 's');
        // 提前5秒更新
        if (!wechatAccount.get('expiresAt') || diff < 5) {
          AV.Cloud.run('getWechatAccessToken', {
            grantType: wechatAccount.get('grantType'),
            appId: wechatAccount.get('appId'),
            secret: wechatAccount.get('secret'),
            notListen: true
          });
        }
      }
      response.success({});
    },
    error: function(error) {
      console.log(error);
      response.error(error);
    }
  });
});

module.exports = AV.Cloud;
