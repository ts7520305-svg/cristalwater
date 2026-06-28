CrystalUI.register("navbar",(data)=>`

<nav class="cw-bottom">

${(data.items||[]).map(item=>`

<a href="${item.href}"

class="${item.active?"active":""}">

${item.label}

</a>

`).join("")}

</nav>

`);
