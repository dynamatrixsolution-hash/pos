// 100 curated hospitality & dining review templates (ratings 3, 4, and 5 stars only).
// Each template supports optional {name} interpolation for the restaurant/hotel name.

export type AllowedReviewRating = 3 | 4 | 5;

const FIVE_STAR_REVIEWS: readonly string[] = [
  "Outstanding food and warm hospitality at {name}. Every dish came out fresh, flavorful, and piping hot.",
  "Loved the dining experience at {name}! Quick service, cozy ambience, and delicious food from start to finish.",
  "Hands down one of the best meals I have had recently. The staff at {name} were attentive and genuinely welcoming.",
  "Everything we ordered at {name} tasted authentic and freshly prepared. Ordering via the table QR was super smooth too!",
  "Wonderful atmosphere, clean seating, and mouth-watering dishes. {name} definitely deserves 5 stars.",
  "Super impressed with both the kitchen speed and food quality at {name}. Will definitely visit again with family.",
  "Great portions, balanced spices, and polite staff. {name} made our evening really memorable.",
  "From appetizers to drinks, everything at {name} was spot on. Highly recommend this place!",
  "Fantastic hospitality! The team at {name} checked on us at the right moments without ever rushing us.",
  "Fresh ingredients, rich flavors, and spotless presentation. {name} is now one of my favorite dining spots.",
  "The food arrived quickly and tasted amazing. Really enjoyed the relaxed vibe at {name}.",
  "Seamless QR ordering and real-time kitchen updates made dining at {name} effortless. Loved the food!",
  "Every single item on our table was a hit. Thank you to the chefs and staff at {name}!",
  "Warm lighting, great music, and unforgettable flavors. {name} gets every detail right.",
  "Consistent quality every time I visit {name}. Clean, welcoming, and always delicious.",
  "Top-notch service and delicious signature dishes. {name} exceeded our expectations in every way.",
  "Brought friends here for dinner and everyone raved about the food. Great job, {name}!",
  "Super friendly staff and generous portions for the price. {name} is worth every penny.",
  "The flavors were rich and authentic, and the drinks paired perfectly. Can't wait to come back to {name}.",
  "Spotless dining area, courteous team, and food that tastes like real craft. Five stars for {name}!",
  "Really appreciated how fast our order was prepared even during a busy hour. Bravo to the {name} kitchen!",
  "A true gem! Everything we tried at {name} was seasoned to perfection.",
  "Comfortable seating, great menu variety, and super responsive staff. {name} is a must-visit.",
  "Best hospitality in town. {name} makes you feel valued from the moment you sit down.",
  "Loved how transparent the bill and live order tracking were at {name}. And the food was phenomenal!",
  "Fresh, aromatic, and beautifully plated. {name} clearly cares about quality.",
  "Had an amazing lunch at {name}. Fast kitchen turnaround and genuinely delicious dishes.",
  "Great place for both casual hangouts and family dinners. {name} never disappoints.",
  "The spices, texture, and freshness were 10/10. Big compliments to the kitchen team at {name}!",
  "Polite waiters, clean tables, and delicious food. Couldn't ask for a better experience at {name}.",
  "Every bite was full of flavor. {name} is easily a 5-star experience.",
  "Loved the welcoming energy at {name}. Great food, fair pricing, and smooth service.",
  "Came in hungry and left completely happy! {name} nailed both taste and service.",
  "One of the cleanest and most well-managed places I have dined at. Great food at {name}!",
  "The drinks were refreshing and the main course was heavenly. {name} is a standout!",
  "Super convenient ordering and super tasty food. {name} sets a high bar for local hospitality.",
  "Delighted by the freshness of every dish. {name} is our new go-to spot!",
  "Warm smiles, speedy service, and bold flavors. {name} is worth visiting again and again.",
  "Everything arrived hot and exactly as requested. Thank you for the wonderful meal, {name}!",
  "Great value, delicious menu, and relaxing ambience. Five stars all the way for {name}.",
  "You can taste the care put into the cooking at {name}. Thoroughly enjoyed our visit.",
  "Smooth experience from scanning the table QR to settling the bill. Food at {name} was delicious!",
  "Highly impressed by the hygiene and quality at {name}. Every dish tasted freshly made.",
  "A memorable dining experience with family. {name} took great care of us.",
  "Rich flavors, crisp textures, and great hospitality. {name} truly shines.",
  "Loved the menu selection at {name} — something delicious for everyone at our table.",
  "Quick service, great taste, and zero hassle. Will gladly recommend {name} to friends.",
  "Everything was cooked just right and served with a smile. Thank you, {name}!",
  "An absolute pleasure dining at {name}. Delicious food and comfortable ambience.",
  "Simply wonderful! Great food, attentive staff, and a very pleasant atmosphere at {name}.",
];

const FOUR_STAR_REVIEWS: readonly string[] = [
  "Really good food and pleasant atmosphere at {name}. Service was polite and smooth overall.",
  "Enjoyed our meal at {name}! Tasty dishes, fair prices, and a clean dining space.",
  "Solid dining spot with flavorful dishes and helpful staff. Would gladly visit {name} again.",
  "Very tasty food and convenient QR ordering at {name}. Slightly busy during peak hour, but worth the wait.",
  "Nice ambience and well-prepared food at {name}. Good spot for lunch or dinner with friends.",
  "Liked the flavors and portion sizes at {name}. Friendly staff made the visit comfortable.",
  "Good menu variety and fresh ingredients at {name}. A very enjoyable evening overall.",
  "Clean place, courteous staff, and delicious mains at {name}. Happy with the experience.",
  "Great taste and reasonable pricing at {name}. Smooth ordering and quick table service.",
  "Everything we tried at {name} was fresh and satisfying. Definitely a reliable place to dine.",
  "Pleasant vibe and tasty dishes at {name}. Looking forward to trying more items next time.",
  "Good food quality and attentive team at {name}. Easy to recommend to friends and family.",
  "Had a nice dinner at {name}. Flavorful dishes, clean seating, and welcoming service.",
  "Impressed by the freshness and neat presentation at {name}. Great value for money.",
  "Comfortable ambience and delicious food at {name}. Minor wait during rush, otherwise great!",
  "Tasty food and super easy digital menu at {name}. Overall a very good experience.",
  "Polite staff and well-balanced flavors at {name}. Will definitely stop by again.",
  "Enjoyed the appetizers and drinks at {name}. Nice place to unwind over good food.",
  "Consistent taste and friendly service at {name}. Very satisfied with our meal.",
  "Freshly cooked dishes and good hospitality at {name}. A solid 4-star experience.",
  "Great portions and warm service at {name}. Clean, well-kept environment.",
  "Really liked the food quality at {name}. Smooth service from order to bill.",
  "Nice spot with good food and calm atmosphere. {name} delivered a pleasant meal.",
  "Flavorful dishes and courteous staff at {name}. Worth visiting when you're nearby.",
  "Good food, transparent billing, and nice ambience at {name}. Happy we came here.",
  "Tasty meals served hot at {name}. Friendly team and comfortable seating.",
  "Very good experience overall at {name}. Loved the freshly prepared dishes.",
  "Well-seasoned food and smooth table service at {name}. Would come back again.",
  "Clean dining area and satisfying menu options at {name}. Great for casual dining.",
  "Enjoyed our time at {name}. Good flavors, fair prices, and welcoming staff.",
];

const THREE_STAR_REVIEWS: readonly string[] = [
  "Decent food and clean seating at {name}. Service was polite, with a little room to be faster during rush.",
  "Had an okay meal at {name}. Flavors were good overall and the staff were friendly.",
  "Nice atmosphere and convenient QR ordering at {name}. Some dishes stood out more than others.",
  "Fair pricing and clean dining area at {name}. A decent option for a quick meal.",
  "Good hospitality from the staff at {name}, though wait time was slightly longer during busy hours.",
  "Satisfactory experience at {name}. Food tasted fresh and portions were reasonable.",
  "Pleasant seating and polite team at {name}. Menu has nice variety to explore.",
  "Decent flavors and neat presentation at {name}. Good for a casual stop.",
  "Comfortable ambience at {name} and easy digital menu. Overall an average-to-good visit.",
  "Friendly staff and clean tables at {name}. Food was fine and served warm.",
  "Reasonable value at {name}. Service was courteous and the bill was clear.",
  "Enjoyed the drinks and snacks at {name}. Main course was decent and filling.",
  "Nice place to sit and chat at {name}. Food quality was good for a casual outing.",
  "Polite team and smooth ordering at {name}. A fair dining experience overall.",
  "Clean environment and decent menu choices at {name}. Would try a different dish next visit.",
  "Food was warm and portions were fair at {name}. Service was helpful when called.",
  "Good location and tidy seating at {name}. Overall a decent meal.",
  "Simple, straightforward dining at {name}. Staff were respectful and accommodating.",
  "Menu was easy to browse and food arrived fresh at {name}. Solid everyday spot.",
  "Fair experience at {name} with friendly service and reasonable prices.",
];

export const REVIEW_TEMPLATES: Record<AllowedReviewRating, readonly string[]> = {
  5: FIVE_STAR_REVIEWS,
  4: FOUR_STAR_REVIEWS,
  3: THREE_STAR_REVIEWS,
};

export function pickShuffledReview(
  rating: AllowedReviewRating,
  businessName: string,
  excludeIndex?: number
): { text: string; index: number } {
  const pool = REVIEW_TEMPLATES[rating] || FIVE_STAR_REVIEWS;
  let index = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && index === excludeIndex) {
    index = (index + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  }
  const safeName = businessName?.trim() || "this restaurant";
  return {
    index,
    text: pool[index].replace(/\{name\}/g, safeName),
  };
}
