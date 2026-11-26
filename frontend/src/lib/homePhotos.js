// Pictures on the welcome page. They are FarmBok's own images, stored with the
// app in frontend/public/images/home/ (two sizes each, so phones download the
// small one), so they work without any outside website.
//
// To change a picture: put new files in public/images/home/ named
// <name>-800.webp and <name>-1600.webp (or change `src` below), keep `alt`
// short and describe what is in the picture.

function local(name) {
  return {
    src: `/images/home/${name}-1600.webp`,
    srcSet: `/images/home/${name}-800.webp 800w, /images/home/${name}-1600.webp 1600w`
  };
}

export const PHOTOS = {
  // Harvest summary: harvested, sold, in store and profit in L$ and US$.
  profit: {
    ...local("profit"),
    alt: "A Liberian farmer smiles at her phone showing her harvest summary and profit in L$ and US$",
    position: "22% 40%"
  },
  // Farm journal: planting, weeding, spraying and feeding.
  journal: {
    ...local("journal"),
    alt: "A farmer planting seedlings next to the FarmBok farm journal with planting, weeding, spraying and feeding",
    position: "30% 40%"
  },
  // Harvest Passport tag with QR code, checked on a phone.
  passport: {
    ...local("passport"),
    alt: "A Harvest Passport tag with a QR code on fresh vegetables, and a phone showing the harvest is verified",
    position: "45% 50%"
  },
  // Harvests for sale and fair market prices.
  market: {
    ...local("market"),
    alt: "A farmer holding a basket of vegetables next to a laptop showing harvests for sale and market prices",
    position: "50% 50%"
  }
};

// The pictures are FarmBok's own, so there are no outside credits to show.
export const PHOTO_CREDITS = [];
