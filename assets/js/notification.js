export function showNotification(message, event, align = "right") {
    const notification = document.getElementById("notification");
    notification.innerHTML = message.replace(/\n/g, "<br>");

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

    setTimeout(() => {
        notification.style.visibility = "hidden";
    }, 1000);
}