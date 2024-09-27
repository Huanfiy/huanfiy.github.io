// 鼠标点击特效：彩色波纹
document.addEventListener("click", function (e) {
  const ripple = document.createElement("span");
  ripple.classList.add("ripple");
  document.body.appendChild(ripple);

  ripple.style.left = `${e.pageX}px`;
  ripple.style.top = `${e.pageY}px`;

  // 使用鲜艳的颜色
  const colors = ["#ff6b6b", "#1dd1a1", "#ff9f43", "#48dbfb", "#f368e0"];
  ripple.style.backgroundColor =
    colors[Math.floor(Math.random() * colors.length)];

  setTimeout(() => {
    ripple.remove();
  }, 1000);
});

// 为 ripple 设置样式
const style = document.createElement("style");
style.innerHTML = `
    .ripple {
        position: absolute;
        width: 20px;
        height: 20px;
        background: red;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        animation: ripple-animation 1s ease-out forwards;
    }

    @keyframes ripple-animation {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(10);
        }
    }
`;
document.head.appendChild(style);
