let liveFeedCount = 0;

// ======================================================
// FEED LIVE
// ======================================================

function addFeedItem(message){

  const feed =
    document.getElementById("liveFeed");

  if (!feed) return;

  const div =
    document.createElement("div");

  div.className =
    "feed-item";

  div.innerHTML = `

    <div>

      ${message}

    </div>

    <div class="feed-time">

      ${
        new Date()
          .toLocaleTimeString("pt-PT")
      }

    </div>

  `;

  feed.prepend(div);

  liveFeedCount++;

  const notif =
    document.getElementById(
      "liveNotifications"
    );

  if (notif){

    notif.innerText =
      liveFeedCount;
  }

  // LIMITAR

  if (
    feed.children.length > 30
  ){

    feed.removeChild(
      feed.lastChild
    );
  }
}