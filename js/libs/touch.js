/* bind touch events to html button
jqBtnElm: jquery element used for button
options: {
	btnClass: css class when button is not pressed,
	btnClassPressed: css class when button is pressed,
	data: optionnal extra data to pass to the action function,
	onAction: action function to trigger on touch end
}
*/
function bindTouchButton(jqBtnElm, options) {
	"use strict";
	jqBtnElm.bind("touchstart", function () {
		if (options.btnClassPressed) {
			jqBtnElm.removeClass().addClass(options.btnClassPressed);
		}
		jqBtnElm.bind("touchend", function (e) {
			if (options.btnClass) {
				jqBtnElm.removeClass().addClass(options.btnClass);
			}
			if (options.data) {
				e.data = options.data;
			}
			if (typeof options.onAction === "function") {
				options.onAction(e);
			}
			jqBtnElm.unbind("touchend");
		});
		jqBtnElm.bind("touchmove", function () {
			if (options.btnClass) {
				jqBtnElm.removeClass().addClass(options.btnClass);
			}
			jqBtnElm.unbind("touchend");
		});
	});
}