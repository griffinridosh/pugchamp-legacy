/* jshint node: true, esversion: 6, eqeqeq: true, latedef: true, undef: true, unused: true */
"use strict";

const _ = require('lodash');
const Botkit = require('botkit');
const co = require('co');
const config = require('config');
const Q = require('q');

module.exports = function(app, database, io, self, server) {
    const SLACK_INCOMING_WEBHOOK_URL = config.get('server.slack.incomingWebhook');
    const SLACK_MESSAGE_DEFAULTS = config.get('server.slack.messageDefaults');

    if (SLACK_INCOMING_WEBHOOK_URL) {
        var controller = Botkit.slackbot();
        var bot = controller.spawn({
            incoming_webhook: {
                url: SLACK_INCOMING_WEBHOOK_URL
            }
        });

        self.postToSlack = co.wrap(function* postToSlack(message) {
            yield Q.ninvoke(bot, 'sendWebhook', _.defaultsDeep(message, SLACK_MESSAGE_DEFAULTS));
        });
    }
    else {
        self.postToSlack = function postToSlack() {};
    }
};
