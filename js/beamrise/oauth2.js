/*global window, chrome, console, XMLHttpRequest */

var OAuth2 = (function () {
	"use strict";

	var providers = {
			"Beamrise": {
				clientId: "beamrise",
				clientSecret: "superSecretKey",
				authorizationDialog: {
					url: "https://api.beamrise.com/authentication/OAuth2/Authorize",
					extraParams: {
						scope: "credentials profile"
					}
				},
				tokenRequest: {
					url: "https://api.beamrise.com/authentication/OAuth2/Token",
					encoding: JSON
				},
				profileRequest: {
					url: "https://api.beamrise.com/authentication/OAuth2/Profile",
					encoding: JSON
				}
			}
		},
		tabMap = {},
		idMap = {},
		nextId = 0,
		redirectUri = chrome.extension.getURL("oauth2response.html"),
		safetyWindow = 5 * 60 * 1000; //5 minutes safety window

	function doHttpRequest(method, url, data, headers, callback) {
		var xhr = new XMLHttpRequest(),
			triggered = false;

		xhr.onreadystatechange = function () {
			var decoded;
			if (xhr.readyState === 4 && !triggered) { //Done
				triggered = true;
				if (xhr.status !== 200) {
					callback(false, xhr.statusText);
				} else {
					callback(true, xhr.responseText, xhr);
				}
			}
		};
		
		if (method === "GET" && ('object' === typeof data) && data !== null) {
			url+="?" + QueryString.stringify(data);
		}

		xhr.open(method, url, true);
		if ('object' === typeof data && method === "POST") {
			xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		}
		Object.keys(headers).forEach(function (key) {
			xhr.setRequestHeader(key, headers[key]);
		});
		if (method === "POST") {
			xhr.send(('string' === typeof data) ? data : QueryString.stringify(data));
		} else {
			xhr.send();
		}
	}

	/*
	 * Request authorization from the user
	 * Callback of the form of (ok, retval)
	 * ok = true for OK, false for error
	 * in case of error, retval is a reason or error message
	 * If the user closes the window, callback(false, "cancelled");
	 */
	function requestAuthorizationCode(providerId, callback) {
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var currentTabId,
			provider = providers[providerId],
			triggered = false,
			onTabRemoved,
			id = (nextId += 1),
			query = {
				"response_type": "code",
				"client_id": provider.clientId,
				"redirect_uri": redirectUri,
				"state": id
			},
			authorizationUrl,
			cbObj = {};
		
		cbObj.id = id;
		cbObj.tabId = undefined;
		cbObj.callback = function (ok, code) {
			var tabId = cbObj.tabId;
			cbObj.tabId = undefined;
			delete idMap[cbObj.id];
			if (tabId !== undefined) {
				delete tabMap[tabId];
				chrome.tabs.remove(tabId);
			}
			if (!ok) {
				callback(false, code);
			} else {
				callback(true, code);
			}
		};
		
		Object.keys(provider.authorizationDialog.extraParams || {}).forEach(function (key) {
			query[key] = provider.authorizationDialog.extraParams[key];
		});
		
		authorizationUrl = provider.authorizationDialog.url + "?" + Object.keys(query).map(function (key) {
			return encodeURIComponent(key) + "=" + encodeURIComponent(query[key]);
		}).join("&");

		
		idMap[id] = cbObj;
		chrome.tabs.create({url: authorizationUrl}, function (tab) {
			cbObj.tabId = tab.id;
			tabMap[cbObj.tabId] = cbObj;
		});
		/*
		chrome.windows.create({
			url: authorizationUrl,
			focused: true,
			type: "popup"
		}, function (wnd) {
			cbObj.tabId = wnd.tabs[0].id;
			tabMap[cbObj.tabId] = cbObj;
		});
		*/
	}
	
	function requestAuthorizationCodeUrl(providerId, returnUrl, state, cb) {
		if (!providers.hasOwnProperty(providerId)) {
			return cb(false, "Unknown provider: " + providerId);
		}
		if ((typeof cb) !== "function") {
			throw new Error("Expected function callback");
		}
		
		var provider = providers[providerId],
			query = {
				"response_type": "code",
				"client_id": provider.clientId,
				"redirect_uri": redirectUri,
				"state": "redir:" + btoa(JSON.stringify({u:returnUrl,s:state}))
			},
			authorizationUrl;
		
		Object.keys(provider.authorizationDialog.extraParams || {}).forEach(function (key) {
			query[key] = provider.authorizationDialog.extraParams[key];
		});
		
		authorizationUrl = provider.authorizationDialog.url + "?" + Object.keys(query).map(function (key) {
			return encodeURIComponent(key) + "=" + encodeURIComponent(query[key]);
		}).join("&");
		
		cb(true, authorizationUrl);
	}
	
	chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
		var cbObj = tabMap[tabId];
		if (cbObj !== null && ('object' === typeof cbObj)) {
			delete tabMap[tabId];
			cbObj.tabId = undefined;
			cbObj.callback(false, "cancelled");
		}
	});

	Coordinator.registerService("OAuth2AuthResponse").onMessage.addListener(function (message, sender, callback) {
		if (message !== null && 'object' === (typeof message)) {
			var cbObj = idMap[message.state];
			if (cbObj && 'object' === (typeof cbObj)) {
				if ((typeof message.code) === 'string' && message.code.length > 0) {
					cbObj.callback(true, message.code);
				} else if ((typeof message.error) === 'string' && message.error.length > 0) {
					cbObj.callback(false, message.error);
				} else {
					cbObj.callback(false, "Unknown error");
				}
			}
		}
	});

	/*
	 * Turns Authentication Code into authentication data that can be used to actually do something.
	 */
	function getAuthenticationDataFromCode(providerId, authorizationCode, callback) {
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var xhr = new XMLHttpRequest(),
			provider = providers[providerId],
			query = {
				"code": authorizationCode,
				"client_id": provider.clientId,
				"client_secret": provider.clientSecret,
				"redirect_uri": redirectUri,
				"grant_type": "authorization_code"
			},
			requestedDate = new Date();

		if ('function' !== typeof callback) {
			throw new Error("Expected a function callback");
		}
		
		doHttpRequest("POST", provider.tokenRequest.url, query, {}, function (ok, responseText) {
			if (!ok) {
				return callback(false, responseText);
			}
			var decoded,
				authData = {};
			try {
				decoded = provider.tokenRequest.encoding.parse(responseText);
			} catch (e) {
				return callback(false, e.toString());
			}
			if ('object' !== typeof decoded || "string" !== typeof decoded.access_token) {
				return callback(false, "Invalid data");
			}
			console.log(decoded);
			authData.requestedDate = requestedDate.getTime();
			authData.expiryDate = requestedDate.getTime() + ((decoded.expires_in || decoded.expires) * 1000);
			authData.accessToken = decoded.access_token;
			if ('string' === typeof decoded.refresh_token) {
				authData.refreshToken = decoded.refresh_token;
			}
			if ('string' === typeof decoded.token_type) {
				authData.tokenType = decoded.token_type;
			}
			callback(true, authData);
		});
	}
	
	function getAuthenticationDataFromRefreshToken(providerId, refreshToken, callback) {
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var xhr = new XMLHttpRequest(),
			provider = providers[providerId],
			query = {
				"refresh_token": refreshToken,
				"client_id": provider.clientId,
				"client_secret": provider.clientSecret,
				//"redirect_uri": redirectUri,
				"grant_type": "refresh_token"
			},
			requestedDate = new Date();

		if ('function' !== typeof callback) {
			throw new Error("Expected a function callback");
		}
		
		doHttpRequest("POST", provider.tokenRequest.url, query, {}, function (ok, responseText) {
			if (!ok) {
				return callback(false, responseText);
			}
			var decoded,
				authData = {};
			try {
				decoded = provider.tokenRequest.encoding.parse(responseText);
			} catch (e) {
				return callback(false, e.toString());
			}
			if ('object' !== typeof decoded || "string" !== typeof decoded.access_token) {
				return callback(false, "Invalid data");
			}
			console.log(decoded);
			authData.requestedDate = requestedDate.getTime();
			authData.expiryDate = requestedDate.getTime() + ((decoded.expires_in || decoded.expires) * 1000);
			authData.accessToken = decoded.access_token;
			if ('string' === typeof decoded.refresh_token) {
				authData.refreshToken = decoded.refresh_token;
			} else {
				authData.refreshToken = refreshToken;
			}
			if ('string' === typeof decoded.token_type) {
				authData.tokenType = decoded.token_type;
			}
			callback(true, authData);
		});
	}
	
	function getAuthenticationDataFromAccessToken(providerId, accessToken, callback) {
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var xhr = new XMLHttpRequest(),
			provider = providers[providerId],
			query = {
				"fb_exchange_token": accessToken,
				"client_id": provider.clientId,
				"client_secret": provider.clientSecret,
				//"redirect_uri": redirectUri,
				"grant_type": "fb_exchange_token"
			},
			requestedDate = new Date();

		if ('function' !== typeof callback) {
			throw new Error("Expected a function callback");
		}
		
		doHttpRequest("POST", provider.tokenRequest.url, query, {}, function (ok, responseText) {
			if (!ok) {
				return callback(false, responseText);
			}
			var decoded,
				authData = {};
			try {
				decoded = provider.tokenRequest.encoding.parse(responseText);
			} catch (e) {
				return callback(false, e.toString());
			}
			if ('object' !== typeof decoded || "string" !== typeof decoded.access_token) {
				return callback(false, "Invalid data");
			}
			console.log(decoded);
			authData.requestedDate = requestedDate.getTime();
			authData.expiryDate = requestedDate.getTime() + ((decoded.expires_in || decoded.expires) * 1000);
			authData.accessToken = decoded.access_token;
			if ('string' === typeof decoded.refresh_token) {
				authData.refreshToken = decoded.refresh_token;
			}
			if ('string' === typeof decoded.token_type) {
				authData.tokenType = decoded.token_type;
			}
			callback(true, authData);
		});
	}
	
	function requestAuthenticationData(providerId, callback) {
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		requestAuthorizationCode(providerId, function (ok, authorizationCode) {
			if (!ok) {
				return callback.apply(this, Array.prototype.slice.call(arguments, 0));
			}
			getAuthenticationDataFromCode(providerId, authorizationCode, callback);
		});
	}
	
	function saveAuthenticationData(providerId, authenticationData, callback) {
		if ('function' !== typeof(callback)) {
			throw new Error("Expected callback function");
		}
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var savedObject = {};
		savedObject.providerId = providerId;
		if (('string' === typeof authenticationData.refreshToken) && authenticationData.refreshToken.length > 0) {
			savedObject.refreshToken = authenticationData.refreshToken;
		} else {
			savedObject.accessToken = authenticationData.accessToken;
			savedObject.expiryDate = authenticationData.expiryDate;
		}
		callback(true, btoa(JSON.stringify(savedObject)));
	}
	
	function loadAuthenticationData(providerId, savedData, callback) {
		if ('function' !== typeof(callback)) {
			throw new Error("Expected callback function");
		}
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var savedObject = JSON.parse(atob(savedData)),
			provider = providers[providerId];
		console.log("Loading authentication data ", savedObject);
		
		if (savedObject.providerId !== providerId) {
			return callback(false, "Invalid provider");
		}
		
		if (('string' === typeof savedObject.refreshToken) && savedObject.refreshToken.length > 0) {
			getAuthenticationDataFromRefreshToken(providerId, savedObject.refreshToken, callback);
			return;
		} else if (('string' === typeof savedObject.accessToken) && savedObject.accessToken.length > 0) {
			//TODO: Check validity here?
			getAuthenticationDataFromAccessToken(providerId, savedObject.accessToken, callback)
		} else {
			callback(false, "Authentication data could not be loaded");
		}
	}

	/*function getAccessToken(providerId, refreshToken, forceRefresh, callback) {
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		if ('function' === typeof forceRefresh && 'function' !== typeof callback) {
			callback = forceRefresh;
			forceRefresh = false;
		}
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		//Go ahead and request a refresh
		var xhr = new XMLHttpRequest(),
			provider = providers[providerId],
			query = {
				"refresh_token": refreshToken,
				"client_id": provider.clientId,
				"client_secret": provider.clientSecret,
				"grant_type": "refresh_token"
			},
			queryString = Object.keys(query).map(function (key) { return encodeURIComponent(key) + "=" + encodeURIComponent(query[key]); }).join("&"),
			triggered = false;

		xhr.onreadystatechange = function () {
			var decoded;
			if (xhr.readyState === 4 && !triggered) { //Done
				triggered = true;
				if (xhr.status !== 200) {
					callback(false, xhr.statusText);
				} else {
					try {
						decoded = JSON.parse(xhr.responseText);
					} catch (e) {
						return callback(false, e.toString());
					}
					if ('object' !== typeof decoded) {
						return callback(false, "Invalid data");
					}
					callback(true, decoded);
				}
			}
		};

		xhr.open("POST", provider.tokenRequest.url, true);
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		xhr.send(queryString);
	}

	function getProfile(refreshToken, callback) {
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		getAccessToken(refreshToken, function (ok, accessToken, tokenType) {
			if (!ok) {
				return callback.apply(this, Array.prototype.slice.call(arguments, 0));
			}
			var xhr = new XMLHttpRequest(),
				triggered = false;

			xhr.onreadystatechange = function () {
				var decoded;
				if (xhr.readyState === 4 && !triggered) { //Done
					triggered = true;
					if (xhr.status !== 200) {
						callback(false, xhr.statusText);
					} else {
						try {
							decoded = JSON.parse(xhr.responseText);
						} catch (e) {
							return callback(false, e.toString());
						}
						if ('object' !== typeof decoded && decoded !== null) {
							return callback(false, "Invalid data");
						}
						callback(true, decoded);
					}
				}
			};

			xhr.open("GET", "https://www.googleapis.com/oauth2/v2/userinfo", true);
			xhr.setRequestHeader("Authorization", tokenType + " " + accessToken);
			xhr.send();
		});
	}

	function getTokenInfo(refreshToken, callback) {
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		getAccessToken(refreshToken, function (ok, accessToken, tokenType) {
			if (!ok) {
				return callback.apply(this, Array.prototype.slice.call(arguments, 0));
			}
			var xhr = new XMLHttpRequest(),
				triggered = false;

			xhr.onreadystatechange = function () {
				var decoded;
				if (xhr.readyState === 4 && !triggered) { //Done
					triggered = true;
					if (xhr.status !== 200) {
						callback(false, xhr.statusText);
					} else {
						try {
							decoded = JSON.parse(xhr.responseText);
						} catch (e) {
							return callback(false, e.toString());
						}
						if ('object' !== typeof decoded && decoded !== null) {
							return callback(false, "Invalid data");
						}
						callback(true, decoded);
					}
				}
			};

			xhr.open("POST", "https://www.googleapis.com/oauth2/v2/tokeninfo", true);
			xhr.setRequestHeader("Authorization", tokenType + " " + accessToken);
			xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
			xhr.send("access_token=" + encodeURIComponent(accessToken));
		});
	}*/
	
	function getAccessToken(providerId, authenticationData, safetyWindow, callback) {
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var provider = providers[providerId],
			expiryNeeded = new Date().getTime() + (safetyWindow * 1000);
		if (expiryNeeded < authenticationData.expiryDate) {
			callback(true, provider.clientId, authenticationData.accessToken, authenticationData, false);
		} else if (('string' === typeof authenticationData.refreshToken) && authenticationData.refreshToken.length > 0) {
			getAuthenticationDataFromRefreshToken(providerId, authenticationData.refreshToken, function (ok, authenticationData) {
				if (!ok) {
					return callback(false, authenticationData);
				}
				callback(true, provider.clientId, authenticationData.accessToken, authenticationData, true);
			});
		} else {
			getAuthenticationDataFromAccessToken(providerId, authenticationData.accessToken, function (ok, authenticationData) {
				if (!ok) {
					return callback(false, authenticationData);
				}
				callback(true, provider.clientId, authenticationData.accessToken, authenticationData, true);
			});
		}
	}
	
	function getProfile(providerId, authenticationData, callback) {
		if ('function' !== typeof callback) {
			throw new Error("Expected function callback");
		}
		if (!providers.hasOwnProperty(providerId)) {
			return callback(false, "Unknown provider: " + providerId);
		}
		var provider = providers[providerId];
		if (!provider.profileRequest || !provider.profileRequest.url) {
			return callback(false, "Provider does not support profile request");
		}
		getAccessToken(providerId, authenticationData, 60 * 5, function (ok, clientId, accessToken, authenticationData, authDataChanged) {
			if (!ok) {
				return callback(false, clientId);
			}
			doHttpRequest("GET", provider.profileRequest.url, {}, {"Authorization": "Bearer " + accessToken},function (ok, data) {
				if (!ok) {
					return callback(false, data);
				}
				var data;
				try {
					data = provider.profileRequest.encoding.parse(data);
				} catch (e) {
					callback(false, e.toString());
					return;
				}
				callback(true, data, authenticationData, authDataChanged);
			});
		});
	}

	return {
		requestAuthorizationCode: requestAuthorizationCode,
		requestAuthorizationCodeUrl: requestAuthorizationCodeUrl,
		getAuthenticationDataFromCode: getAuthenticationDataFromCode,
		requestAuthenticationData: requestAuthenticationData,
		saveAuthenticationData: saveAuthenticationData,
		loadAuthenticationData: loadAuthenticationData,
		getAccessToken: getAccessToken,
		getProfile: getProfile
	};
}());