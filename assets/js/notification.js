let hideTimerId = null;

export function showNotification(message, event, align = "right", options = {}) {
    const notification = document.getElementById("notification");
    notification.innerHTML = message.replace(/\n/g, "<br>");

    // 前回の自動非表示タイマーが残っていると新しい通知まで消してしまうため解除する
    if (hideTimerId !== null) {
        clearTimeout(hideTimerId);
        hideTimerId = null;
    }

    if (options.dismissible) {
        // 閉じるボタン付きの通知は、ボタンが押されるまで消えない
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "notification-close";
        closeButton.textContent = "✕";
        closeButton.setAttribute(
            "aria-label",
            window.vanilla_i18n_instance?.translate("ariaLabels.closeNotification") || "通知を閉じる"
        );
        closeButton.addEventListener("click", () => {
            notification.style.visibility = "hidden";
        });
        notification.appendChild(closeButton);
        notification.classList.add("has-close");
    } else {
        notification.classList.remove("has-close");
    }

    if (event && event.pageX !== undefined && event.pageY !== undefined) {
        notification.style.top = `${event.pageY}px`;

        const scrollX = window.scrollX || window.pageXOffset || 0;
        const notificationWidth = notification.offsetWidth;
        const minLeft = scrollX + 10;
        const maxLeft = scrollX + window.innerWidth - notificationWidth - 10;
        let leftValue = align === "left" ? event.pageX - notificationWidth : event.pageX;
        leftValue = Math.min(Math.max(leftValue, minLeft), maxLeft);
        notification.style.left = `${leftValue}px`;
        notification.style.transform = "translate(0, -100%)";
    } else {
        notification.style.top = "50%";
        notification.style.left = "50%";
        notification.style.transform = "translate(-50%, -50%)";
    }

    notification.style.visibility = "visible";

    if (!options.dismissible) {
        hideTimerId = setTimeout(() => {
            notification.style.visibility = "hidden";
            hideTimerId = null;
        }, 1000);
    }
}
