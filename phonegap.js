/*
WARNING: this file is for debugging on desktop only !
rename this file (to phonegap.js.test) before building
*/

// dummy contacts
navigator.contacts = {
	find: function (a, b, c, d) {
		b([
			{
				displayName: "cest moi",
				phoneNumbers: [{value: "06060606"}],
				emails: [{value: "raf@raf.com"}]
			},
			{
				displayName: "Coucou",
				phoneNumbers: [{value: "09090909"}],
				emails: [{value: "raf2@raf2.com"}]
			},
			{
				displayName: "cest moi",
				phoneNumbers: [{value: "06060606"}],
				emails: [{value: "raf@raf.com"}]
			},
			{
				displayName: "Coucou",
				phoneNumbers: [{value: "09090909"}],
				emails: [{value: "raf2@raf2.com"}]
			},
			{
				displayName: "cest moi",
				phoneNumbers: [{value: "06060606"}],
				emails: [{value: "raf@raf.com"}]
			},
			{
				displayName: "Coucou",
				phoneNumbers: [{value: "09090909"}],
				emails: [{value: "raf2@raf2.com"}]
			},
		]);
	}
};

// alert as notification
navigator.notification = {
	alert: function (s) {
		window.alert(s);
	}
};

// use click instead of touch
function bindTouchButton(jqBtnElm, options) {
	"use strict";
	jqBtnElm.bind("click", function (e) {
		if (options.data) {
			e.data = options.data;
		}
		if (typeof options.onAction === "function") {
			options.onAction(e);
		}
	});
	if (options.btnClassPressed) {
		jqBtnElm.bind("mouseover", function () {
			$(this).removeClass().addClass(options.btnClassPressed);
		});
	}
	if (options.btnClass) {
		jqBtnElm.bind("mouseout", function () {
			$(this).removeClass().addClass(options.btnClass);
		});
	}
}

// trigger deviceready event
var deviceReadyEvent = new Event("deviceready");
$(function () {
	document.dispatchEvent(deviceReadyEvent);
});