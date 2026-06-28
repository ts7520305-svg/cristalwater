CrystalUI.register("button",(data)=>`

<button

class="cw-btn ${data.class||"cw-btn-primary"}"

onclick="${data.action||""}"

>

${data.label||"Botão"}

</button>

`);
