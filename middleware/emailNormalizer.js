'use strict'

module.exports = function normalizeEmail(email) {
  if (typeof email != 'string') {
    throw new TypeError('normalize-email expects a string')
  }

  email = email.toLowerCase()

  var emailParts = email.split(/@/)
  var username = emailParts[0]
  var domain = emailParts[1]

  if (isNormalizeableProvider(domain)) {
    username = username.split('+')[0]

    if(!/hotmail\.com$/.test(domain)) {
      username = username.replace(/\./g, '')
    }
  }

  if (domain == 'googlemail.com') {
    domain = 'gmail.com'
  }

  return username + '@' + domain
}

function isNormalizeableProvider(domain) {
  return /^hotmail\.com|gmail\.com|googlemail\.com|live\.com$/.test(domain)
}
