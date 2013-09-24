/*jslint browser:true*/
/*global $, alert, bindTouchButton*/

// application parameters and global variables
var app = {
		title: "Beamrise Messenging",
		version: "1.0.0.1",
		retryFrequency: 5000,
		fadeSpeed: 400,
		contacts: [],
		displayedContacts: [],
		conversations: {},
		currentConversation: undefined
	};

// just output debug on screen
function dbg(s) {
	"use strict";
	$("#divDebug").text($("#divDebug").text() + " " + s);
}

// when a contact img fails
function onImgLoadFail(e) {
	"use strict";
	$(e.target).unbind("error").attr("src", "img/defaultAvatar.jpg");
}

// this function shows the loader during the 'process' function, and then triggers 'onDoneCallback'
function showLoading(process, onDoneCallback) {
	"use strict";
	$("#divLoginScreen").hide(0);
	$("#divContactsScreen").hide(0);
	$("#divChatScreen").hide(0);
	$("#divLoading").fadeIn(app.fadeSpeed, function () {
		if (typeof process === "function") {
			process();
		}
		$("#divLoading").fadeOut(app.fadeSpeed, function () {
			if (typeof onDoneCallback === "function") {
				onDoneCallback();
			}
		});
	});
}

function getNetworkLogo(networkId) {
	"use strict";
	var imgNetworkLogo = "img/phone0.png";
	switch (networkId) {
	case "facebook":
		imgNetworkLogo = "img/fb0.png";
		break;
	case "gtalk":
		imgNetworkLogo = "img/gt0.png";
		break;
	case "wlm":
		imgNetworkLogo = "img/wlm0.png";
		break;
	}
	return imgNetworkLogo;
}

// log in to beamrise
function callBeamriseAuth(e) {
	"use strict";
	var winref = window.open("https://api.beamrise.com/authentication/account/NetworkLogIn?networkId="
		+ e.data.networkId + "&returnUrl=http://localhost", "_blank", "location=no");
	winref.addEventListener("loadstart", function (e) {
		var url = e.url;
		dbg(url);
		if (url.indexOf("http://localhost") === 0) {
			showLoading(function () {
				winref.close();
			}, function () {
				$("#divLoginScreen").fadeIn(app.fadeSpeed);
			});
		}
	});
}

// loads and displays messages of current selected conversation
function refreshCurrentConversationMessages() {
	"use strict";
	var i, divmsg, divmsgWrap, img;
	$("#divChatMessages").empty();
	for (i = 0; i < app.currentConversation.history.length; i += 1) {
		divmsgWrap = $(document.createElement("div"));
		divmsgWrap.addClass("divMsgWrap");
		divmsg = $(document.createElement("div"));
		divmsg.addClass("divMsg");
		img = $(document.createElement("img"));
		img.bind("error", onImgLoadFail);
		if (app.currentConversation.history[i].sender) {
			divmsgWrap.addClass("divMsgWrapReceived");
			img.addClass("imgMsgReceived");
			img.attr("src", app.currentConversation.buddy.image || "img/defaultAvatar.jpg");
		} else {
			divmsgWrap.addClass("divMsgWrapSent");
			img.addClass("imgMsgSent");
			img.attr("src", "img/defaultAvatar.jpg"); // todo: set me image
		}
		divmsg.append(img);
		divmsg.append($(document.createElement("span")).text(app.currentConversation.history[i].content));
		divmsgWrap.append(divmsg);
		$("#divChatMessages").append(divmsgWrap);
	}
}

// displays chat conversation
function openChatWindow(e) {
	"use strict";
	showLoading(function () {
		if (!app.conversations[e.data.networkId + "://" + e.data.id]) {
			app.conversations[e.data.networkId + "://" + e.data.id] = {
				buddy: e.data,
				// *** conversation messages for debugging
				history: [
					{
						content: "Hey !! I'm using Beamrise and I love it.",
						time: new Date()
					},
					{
						content: "Me too. I can hook up to all my favorite networks in just one app. It's so cool.",
						time: new Date(),
						sender: {
							id: e.data.id,
							name: e.data.name || e.data.id,
							image: e.data.image
						}
					},
					{
						content: "Coool!",
						time: new Date()
					}
				]
				// ***
			};
		}
		app.currentConversation = app.conversations[e.data.networkId + "://" + e.data.id];
		refreshCurrentConversationMessages();
		$("#spanChatLabel").text(app.currentConversation.buddy.name || app.currentConversation.buddy.id);
		$("#imgChatNetworkLogo").attr("src", getNetworkLogo(app.currentConversation.buddy.networkId));
	}, function () {
		$("#divChatScreen").fadeIn(app.fadeSpeed, function () {
			$("body").animate({"scrollTop": $("body")[0].scrollHeight});
		});
	});
}

// displays the contacts
function refreshDisplayedContacts() {
	"use strict";
	$("#imgContactsLoading").show(0, function () {
		$("#divContacts").hide(0, function () {
			// first check the search input string for filter
			var	i, divcontact, img, divContactText, imgNetwork,
				searchString = $("#inputSearchContact").val().toLowerCase();
			if (searchString !== "") {
				app.displayedContacts = [];
				app.contacts.filter(function (contact) {
					return contact.name.toLowerCase().indexOf(searchString) >= 0 || contact.id.toLowerCase().indexOf(searchString) >= 0;
				}).forEach(function (contact) {
					app.displayedContacts.push(contact);
				});
				if ($("#searchIcon").attr("src") !== "img/cross.png") {
					$("#searchIcon").attr("src", "img/cross.png");
				}
			} else {
				app.displayedContacts = app.contacts;
				if ($("#searchIcon").attr("src") !== "img/search.png") {
					$("#searchIcon").attr("src", "img/search.png");
				}
			}
			$("#divNoContacts").toggle(app.displayedContacts.length === 0);

			// then output displayedContacts
			$("#divContacts").empty();
			for (i = 0; i < app.displayedContacts.length; i += 1) {
				divcontact = $(document.createElement("div"));
				divcontact.addClass("contact");
				img = $(document.createElement("img"));
				img.addClass("imgContact");
				img.bind("error", onImgLoadFail);
				img.attr("src", app.displayedContacts[i].image || "img/defaultAvatar.jpg");
				divcontact.append(img);

				divContactText = $(document.createElement("div"));
				if (app.displayedContacts[i].name) {
					divContactText.append($(document.createElement("span")).addClass("contactTitle").text(app.displayedContacts[i].name));
					divContactText.append($(document.createElement("br")));
				}
				if (app.displayedContacts[i].id) {
					divContactText.append($(document.createElement("span")).addClass("contactId").text(app.displayedContacts[i].id));
					divContactText.append($(document.createElement("br")));
				}
				if (app.displayedContacts[i].phoneNumber && (app.displayedContacts[i].phoneNumber !== app.displayedContacts[i].id)) {
					divContactText.append($(document.createElement("span")).addClass("contactPhone").text(app.displayedContacts[i].phoneNumber));
				}
				divcontact.append(divContactText);

				imgNetwork = $(document.createElement("img"));
				imgNetwork.attr("src", getNetworkLogo(app.displayedContacts[i].networkId));
				imgNetwork.addClass("smallNetworkLogo");
				divcontact.append(imgNetwork);

				bindTouchButton(divcontact, {
					btnClass: "contact",
					btnClassPressed: "contactPressed",
					data: app.displayedContacts[i],
					onAction: openChatWindow
				});
				$("#divContacts").append(divcontact);
			}
			$("#imgContactsLoading").hide(0, function () {
				$("#divContacts").show(0);
			});
		});
	});
}

// this is launched on app startup: this is where we do bindings for UI elements
function onLoad() {
	"use strict";
	showLoading(function () {
		// init and bind UI buttons
		bindTouchButton($("#btnSettings"), {
			btnClass: "headerRightButton",
			btnClassPressed: "headerRightButtonPressed",
			onAction: function () {
				$("#divContactsScreen").fadeOut(app.fadeSpeed, function () {
					$("#divLoginScreen").fadeIn(app.fadeSpeed);
				});
			}
		});
		bindTouchButton($("#divBackBtn1"), {
			btnClass: "headerIcon",
			btnClassPressed: "headerIconPressed",
			onAction: function () {
				$("#divChatScreen").fadeOut(app.fadeSpeed, function () {
					$("#divContactsScreen").fadeIn(app.fadeSpeed);
				});
			}
		});
		bindTouchButton($("#btnLoginFB"), {
			btnClass: "imgbtn",
			btnClassPressed: "imgbtnPressed",
			data: {networkId: "facebook"},
			onAction: callBeamriseAuth
				/*
				navigator.notification.vibrate(250);
				navigator.notification.beep(1);
				*/
		});
		bindTouchButton($("#btnLoginGT"), {
			btnClass: "imgbtn",
			btnClassPressed: "imgbtnPressed",
			data: {networkId: "gtalk"},
			onAction: callBeamriseAuth
		});
		bindTouchButton($("#btnLoginWLM"), {
			btnClass: "imgbtn",
			btnClassPressed: "imgbtnPressed",
			data: {networkId: "wlm"},
			onAction: callBeamriseAuth
		});
		bindTouchButton($("#btnLoginBeamrise"), {
			btnClass: "btn",
			btnClassPressed: "btnPressed",
			onAction: function () {
				navigator.notification.alert("This feature is not implemented yet.", function () {}, "Not implemented");
				/*
				window.plugins.childBrowser.showWebPage("https://api.beamrise.com/authentication/Account/BeamriseLogIn");
				window.plugins.childBrowser.onLocationChange = function (url) {
					dbg(url);
				};
				*/
			}
		});
		bindTouchButton($("#btnContactsDemo"), {
			btnClass: "btn",
			btnClassPressed: "btnPressed",
			onAction: function () {
				showLoading(function () {
					$("#imgContactsLoading").show();
					// load contacts...
					// an exemple of loading contacts (from local phone instead of xmpp)
					navigator.contacts.find(["displayName", "phoneNumbers", "emails", "photos"], function (phoneContacts) {
						// got contacts success
						app.contacts = [];
						var i, phoneContact;
						for (i = 0; i < phoneContacts.length; i += 1) {
							if (phoneContacts[i].phoneNumbers && phoneContacts[i].phoneNumbers.length > 0) {
								phoneContact = {
									name: phoneContacts[i].displayName,
									phoneNumber: phoneContacts[i].phoneNumbers[0].value,
									id: phoneContacts[i].phoneNumbers[0].value,
									networkId: "phone"
								};
								if (phoneContacts[i].photos && phoneContacts[i].photos.length > 0) {
									phoneContact.image = phoneContacts[i].photos[0].value;
								}
								if (phoneContacts[i].emails && phoneContacts[i].emails.length > 0) {
									phoneContact.id = phoneContacts[i].emails[0].value;
								}
								app.contacts.push(phoneContact);
							}
						}
						refreshDisplayedContacts();
						$("#imgContactsLoading").hide();
					}, function (error) {
						alert(error);
						$("#imgContactsLoading").hide();
					}, {filter: "", multiple: true});
				}, function () {
					$("#divContactsScreen").fadeIn(app.fadeSpeed);
				});
			}
		});
		// bind sending message
		$("#formChatMsg").submit(function (e) {
			if (app.currentConversation) {
				app.currentConversation.history.push({
					content: $("#inputChatMsg").val(),
					time: new Date()
				});
				$("#inputChatMsg").val("");
				refreshCurrentConversationMessages();
				$("body").animate({"scrollTop": $("body")[0].scrollHeight});
			}
			e.preventDefault();
		});
		//bind searching contacts on input
		$("#inputSearchContact").keyup(refreshDisplayedContacts).change(refreshDisplayedContacts);
		// bind clear search btn
		bindTouchButton($("#searchIcon"), {
			btnClass: "bottomInputIcon",
			btnClassPressed: "bottomInputIconPressed",
			onAction: function () {
				if ($("#inputSearchContact").val() !== "") {
					$("#inputSearchContact").val("");
					refreshDisplayedContacts();
				}
			}
		});
	}, function () {
		// when binding is all done, default startup
		$("#divLoginScreen").fadeIn(app.fadeSpeed);
	});
}

// this is triggered where the device is ready : main app entry point which calls 'onLoad'
document.addEventListener("deviceready", function () {
	"use strict";
	$(function () {
		// call main entry point
		onLoad();

		// bind device back button event
		document.addEventListener("backbutton", function () {
			if ($("#divChatScreen").is(":visible")) {
				$("#divChatScreen").fadeOut(app.fadeSpeed, function () {
					$("#divContactsScreen").fadeIn(app.fadeSpeed);
				});
			}
		}, false);

		// bind device search button
		document.addEventListener("searchbutton", function () {
			if (!$("#divContactsScreen").is(":visible")) {
				showLoading(null, function () {
					$("#divContactsScreen").fadeIn(app.fadeSpeed);
				});
			}
		}, false);

		// bind device menu button
		document.addEventListener("menubutton", function () {
			if (!$("#divLoginScreen").is(":visible")) {
				showLoading(null, function () {
					$("#divLoginScreen").fadeIn(app.fadeSpeed);
				});
			}
		}, false);
	});
}, false);