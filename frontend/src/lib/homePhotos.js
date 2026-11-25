// Photos of farming in Liberia used on the welcome page.
//
// Every photo comes from Wikimedia Commons, where files must carry a free
// licence (CC BY, CC BY-SA or public domain). Each one is linked to its Commons
// page, which names the photographer and the exact licence; the welcome page
// footer shows those credits.
//
// To use your own photos instead: put the files in frontend/public/photos/
// and set `src` on the entry to "/photos/your-file.jpg". Keep `alt` short and
// describe what is in the picture.

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/thumb";

// `hash` is the folder Wikimedia stores the file in (the first characters of
// the md5 of the file name). Widths must not be larger than the original.
function commons(file, hash, widths) {
  const name = encodeURIComponent(file.replace(/ /g, "_"));
  const url = (w) => `${COMMONS}/${hash}/${name}/${w}px-${name}`;
  return {
    src: url(widths[widths.length - 1]),
    srcSet: widths.map((w) => `${url(w)} ${w}w`).join(", "),
    page: `https://commons.wikimedia.org/wiki/File:${name}`
  };
}

export const PHOTOS = {
  rice: {
    ...commons("Inland valley rice culivation in Liberia - panoramio.jpg", "c/c8", [960, 1280, 1920]),
    alt: "Green rice growing in a swamp farm in Bong County, Liberia",
    credit: "Inland valley rice, Suakoko, Bong County (Panoramio)",
    position: "50% 55%"
  },
  farmer: {
    ...commons("Farmer's Wife.jpg", "7/77", [960, 1280]),
    alt: "A Liberian woman farmer on her farm",
    credit: "Farmer's wife (Wiki Loves Africa 2016, Liberia)",
    position: "50% 35%"
  },
  plantain: {
    ...commons("Plantain Farm View.jpg", "6/66", [960, 1280]),
    alt: "A plantain farm in Liberia",
    credit: "Plantain farm (Wiki Loves Africa 2016, Liberia)",
    position: "50% 50%"
  },
  market: {
    ...commons("Market stall @ Monrovia, Liberia - panoramio.jpg", "8/84", [500, 960]),
    alt: "A market stall selling rice and food in Monrovia",
    credit: "Market stall, Monrovia (Panoramio, blk24ga)",
    position: "50% 50%"
  },
  rubber: {
    ...commons("Rubber Tree Plantation in Margibi County, Liberia.jpg", "0/09", [960, 1280, 1920]),
    alt: "Rows of rubber trees on a farm in Margibi County, Liberia",
    credit: "Rubber tree plantation, Margibi County",
    position: "50% 50%"
  },
  transport: {
    ...commons("Farmer Motorbike.jpg", "b/b1", [960, 1280]),
    alt: "A farmer with a motorbike on a farm road in Liberia",
    credit: "Farmer and motorbike (Wiki Loves Africa 2016, Liberia)",
    position: "50% 50%"
  }
};

export const PHOTO_CREDITS = Object.values(PHOTOS).map(({ credit, page }) => ({ credit, page }));
