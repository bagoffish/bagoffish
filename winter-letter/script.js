// ====================== STORY DATA (English) ======================
const story = [
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I killed a man in winter." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "Though I cannot say with certainty which winter it was." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "That is the first difficulty." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not that I killed him." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Of that, I am as certain as a man can be of anything that happened long ago." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It is the season that swallowed the year whole." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Winter repeats itself too faithfully." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Every snowfall resembles the last." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Every bare tree holds the same expression." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "An accusation." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Time, once touched by guilt, ceases to proceed in a straight line." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It softens at the edges." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It caves beneath recollection like old floorboards under the weight of someone walking above you in the dark." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Still..." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I remember the cold." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not the abstract cold one speaks of indoors." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not while wrapped in blankets." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not with the floor heating beneath your feet and a kettle muttering on the stove." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I mean the kind that enters through the fingernails first." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The kind that makes the joints of the hand ache before the skin has even begun to sting." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The air that evening was so sharp it seemed to have corners." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Each breath cut my throat on the way down." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Snow had fallen earlier in the day." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "Then stopped." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The wooded hillside became unnaturally still." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As if every sound had been packed under the white crust and buried there." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "My boots sank into the road with a muffled crunch.", sfx: "footsteps" },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Too loud." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Though there was no one close enough to hear." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The road was not much of a road." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Only a narrow strip of frozen dirt climbing through the trees above the villages outside Incheon." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Where the city thinned into farmland." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Where the sea wind came inland through bare branches." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The sort of road that appears on no map unless your family has lived nearby for generations." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I had walked it many times." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Never with a knife in my coat pocket." },

    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "Old Man", text: "Need something?" },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "Me", text: "Just looking." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "Old Man", text: "No one comes in here just to look." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "Me", text: "The owner wore spectacles so thick his eyes seemed detached from his face." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "Me", text: "As if they floated separately behind the lenses." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The knife had a wooden handle." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Slightly black." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The blade was just under twelve centimeters." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I remember the price." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "Old Man", text: "12,000 won." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Exactly 12,000 won." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Because I had thought at the time it was too much for such a plain thing." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "There was a small notch near the hilt where the metal had not been polished properly." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "My thumb found that imperfection often." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It was there beneath my glove as I walked." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Rubbing the same notch again and again." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As if confirming the knife was real." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "And not merely an intention." },

    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "So I walked.", sfx: "footsteps" },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Dusk came early." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It always does in winter." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The light thinned between the trees until everything seemed submerged." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As if the hillside had sunk to the bottom of a frozen sea." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Then I saw him." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "He stood at the side of the road." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Near a cedar whose branches had long since died." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Hardened into black claws against the sky." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "He was not doing anything remarkable." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "That is what horrifies me now." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "He was simply standing there." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Reading a letter." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "His hat was pushed back from his forehead." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "He held the page close to his face because the light was failing." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Once, he lifted his gloved hand and brushed snow from the paper." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Such a small gesture." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "So human." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "So entirely unprepared for what was already approaching him from behind." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I stopped when I first saw him." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The distance between us could not have been more than twenty paces." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Had he turned, he would have seen me plainly." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "But he did not." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "His attention belonged to the letter." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I remember the exact sound of the paper rustling in the sea wind." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I remember one of his boots half-buried in a drift." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I remember thinking..." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not in words." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "But with a blank certainty." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "If I keep walking..." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Something will happen that can never be undone." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I kept walking.", sfx: "footsteps" },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "My heartbeat did not quicken." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "That surprises me even now." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "One imagines murder as frenzy." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "A storm of blood and panic." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "But there was only stillness." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As though I had stepped out of myself." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "And was watching from somewhere behind my own eyes." },

    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/stranger-back.png", name: "Stranger", text: "...?" },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "My right hand moved." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The knife entered beneath his ribs.", sfx: "stab" },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "That is where I had imagined it would go." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Though I did not know until that instant that I had imagined anything at all." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "There was resistance first." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The coat." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The shirt beneath." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "After that..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Nothing." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The blade passed through him with an ease so obscene it offended me." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Flesh should resist." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Bone should intervene." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "But it was as though the body had already opened itself to receive the steel." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "He dropped the letter." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "It fell face-up into the snow." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The black lines of writing stark against the white." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "He made a wet choking noise." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "We slipped together." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "My boots lost purchase." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "We both fell." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "The knife tore sideways as he went down." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Warmth burst over my hand." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "For a moment, I thought I had cut myself." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "But it was his blood." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Soaking through my glove." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Startling in its heat." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "Me", text: "Steam rose where it struck the snow." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "And then he looked at me." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "No hatred." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "No fear." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "Only confusion." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "A terrible, intimate bewilderment." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "As though he were trying to place me." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "As though my face belonged somewhere in his childhood." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Me", text: "Or in a dream." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "Stranger", text: "...Ah..." },

    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "I stood over him for some time." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "I do not know how long." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The hillside had become completely silent." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Even the wind from the harbor seemed to have withdrawn." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "As though it wanted no part in what had happened." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "My breath smoked above us in pale clouds." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "My right hand still held the knife." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I remember noticing that my wrist hurt." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Not from the stabbing." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "From how tightly I had been gripping the handle." },

    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Then practicality asserted itself." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "It came not as panic." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Not even regret." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Only a series of simple facts." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The body was visible." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The road was not empty forever." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Someone might come." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "And if someone came..." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Then all of this would become real." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I dragged him by the ankles.", sfx: "drag" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "He was heavier than I expected." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "Dead weight." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "People say that phrase casually." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "They do not know how literal it feels." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "His coat kept catching on frozen roots beneath the snow." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "His head struck stones as we moved.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "A dull sound." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Again.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "And again.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "That sound still wakes me." },

    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The cedar stood deeper in the trees." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Dead." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Split by lightning long ago." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "One side of its trunk had rotted away." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The roots rose from the ground like ribs." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I chose it because the earth there looked softer." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "It was not." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The frost had hardened the soil to the consistency of brick." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I had no shovel." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I used a branch first." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png-2", name: "Me", text: "It snapped.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Then the knife." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The blade bent slightly." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Then my hands." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The cold burned so intensely it stopped feeling like cold." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "It became merely pain." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Dirt packed under my nails." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The skin across my knuckles split." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I could not feel my fingertips." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Several times, I stopped." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I thought I heard footsteps on the road." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "But it was only my own heartbeat." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "The hole was too shallow." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I knew that even as I lowered him into it." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "His knees would not straighten." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "One arm bent beneath his back." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I almost pulled him out to dig deeper." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "But then his face tilted toward me." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "His eyes were still open." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Snow had melted into them." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "And something in my chest seized." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I began shoveling dirt over him with both hands." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Too quickly." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Hardly caring whether he was covered." },

    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "At one point..." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "His hand emerged again." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Fingers pushing through the loose earth." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "As if reaching upward." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "As if asking for help." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "I struck it with the branch." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "Once.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "Me", text: "Twice.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Until it disappeared." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "When it was done..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I stood over the disturbed patch of snow." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Panting." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Covered in mud." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Covered in blood." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "And then..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I began to laugh." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Not because it was funny." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Because the silence had become unbearable." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "Because if I had not laughed..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "Me", text: "I think I would have screamed so loudly the whole hillside would have answered." },

    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I moved away the following spring.", sfx: "train" },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "No one came for me." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "That was the strangest part." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The world did not rearrange itself around the act." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The woman who sold hotteok near the station still lit her cart every evening." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The church loudspeaker still crackled on Sunday mornings." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Children still kicked half-frozen soccer balls in schoolyards." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No detective appeared." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No notices were posted." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No missing traveler." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "It was as though the man had not existed before I killed him." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "And therefore could not be missed afterward." },

    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "Me", text: "At first, I listened for every footstep outside my room." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Every knock at the door made my hands go numb." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I burned the coat I had worn that night." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I scrubbed the knife until the wooden handle cracked from hot water." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Then one evening..." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I realized I had gone an entire day without thinking of him." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "That frightened me more than the murder." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Because it meant the mind can digest anything." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Given enough time." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Years passed." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Or months." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I cannot say." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I lived in three districts." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Perhaps four." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Small rooms in buildings whose names I never learned." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I took whatever work required little speech." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "Me", text: "I avoided mirrors." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "Dreams came often." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "Snow beneath my boots." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "A letter in the road." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "Me", text: "A man turning too late." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "But waking was always a relief." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Until last night." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The room I occupy now is on the third floor of a boarding house." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The wallpaper is green." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Though smoke from the stove has darkened it into the color of old bruises." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The widow downstairs coughs in her sleep every night just after midnight." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The boards in the hallway swell when it rains." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "So the door sticks unless one lifts it while turning the handle." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "These details matter." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Because they prove this happened in a real place." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "And not merely in the theater of a fever." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The knocking came." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Three times.", sfx: "knock" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Soft." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Polite." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not the pounding of a drunk." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not the landlord." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Each knock separated by the exact same pause." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As though performed by someone counting silently." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The widow's coughing stopped." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The fire gave a small crack." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Then the whole house seemed to hold its breath." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I opened the door." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The corridor was empty." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The lamp at the far end flickered." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No footsteps." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No sound." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Then I looked down." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "An envelope lay on the floorboards." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Damp." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "A thin sheen of moisture covered the paper." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "As though it had been left in snow." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "There was no address." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "No seal." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Only a dark stain in one corner." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I bent to pick it up." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "And recoiled." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The paper was warm." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Not room temperature." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Warm like skin." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Warm like something alive." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Inside was a single folded sheet." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "I recognized the handwriting at once." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Though I had never seen it before." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "That sentence is impossible." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Yet it is true." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Some patterns are known not by sight." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "But by dread." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "My stomach turned before I read the first line." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "Because I understood where I had seen those slanting lines." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "On the paper in the snow." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "Me", text: "The letter the man had been reading before I killed him." },

    // Letter parts
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/letter.png", name: "", text: "If you are reading this...", isLetter: true },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/letter.png", name: "", text: "Then I have already killed you.", isLetter: true },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I screamed." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I did not mean to." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "The sound escaped me." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "I stumbled backward." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Knocked the lamp over." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Oil spilled across the floor." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "By some mercy, it did not ignite." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I could not look away from the doorway." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Certain someone would step through it." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Someone wet with snow." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Someone whose face I had covered with frozen earth." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "No one entered." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Minutes passed." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Perhaps longer." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Eventually..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Because terror becomes compulsion when prolonged..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I picked the letter up again." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "And read the rest." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "You do not know me, though you think you killed me.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "On the contrary, I selected you years ago.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "I knew what you would become.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "I knew the road you would walk.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "The stranger you would meet.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "The knife you would carry.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "I stood there because I had already written it.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "I have always written it.", isLetter: true },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "At the bottom was one final line." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "Look beneath your floorboards.", isLetter: true },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I should have fled." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Any sane man would have fled." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "But guilt is a kind of obedience." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "It trains the soul to answer accusation even when spoken by the dead." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "I took the iron poker." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "And struck the floor." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Once.", sfx: "wood" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Twice.", sfx: "wood" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "On the third blow...", sfx: "wood" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "The board split.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Beneath was a cavity." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Wrapped in a yellowing bedsheet..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Lay a body." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Fresh." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "No smell of decay." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "No skeleton." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Only a man as though recently dead." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "His skin pale." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "A single narrow wound in the chest." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Mud packed beneath the fingernails." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Frozen there." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "It was me." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "My face." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "My mouth slightly open." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "My scar above the left eyebrow." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "The one from childhood." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "The one no stranger should know." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "Me", text: "Myself." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "As I write this..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Someone is knocking again." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Three times.", sfx: "knock" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Soft." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "Polite." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "And from the way the boards creak outside..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "From the rhythm of the breathing beyond the threshold..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "From the strange certainty that has entered me like a second heartbeat..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "I know it is me." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "And when I open the door..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "Me", text: "He will be holding a letter." },
];

// ====================== STORY DATA (Korean) ======================
const storyKO = [
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "나는 겨울에 한 남자를 죽였다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "그것이 정확히 어느 겨울이었는지는 확실히 말할 수 없다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그것이 첫 번째 난관이다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "내가 그를 죽였다는 사실이 아니라." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 점만큼은, 오래된 일에 대해 사람이 가질 수 있는 확신의 한계까지는 확실하다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 계절이 한 해를 통째로 삼켜버렸다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "겨울은 너무도 충실하게 반복된다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "매번 내리는 눈은 이전 눈과 닮아 있다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "모든 벌거벗은 나무는 같은 표정을 짓고 있다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "고발하는 듯한 표정." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "죄책감에 한 번 닿은 시간은 더 이상 직선으로 흐르지 않는다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "가장자리가 부드러워지고." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "어두운 방에서 위층을 걷는 누군가의 무게에 낡은 마루판이 꺼지듯, 기억 아래로 꺼져버린다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그래도..." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 추위를 기억한다." },

    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "실내에서 말하는 그런 추위가 아니다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "이불을 둘둘 말고 있는 추위가 아니다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "바닥 난방이 깔리고 주전자가 보글보글 끓는 그런 추위가 아니다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "손톱부터 스며드는 추위다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "피부가 따끔거리기 전에 손마디가 먼저 저려오는 추위." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그날 저녁 공기는 모서리가 있을 것처럼 날카로웠다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "숨을 들이쉴 때마다 목이 베이는 듯했다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그날 낮에 눈이 내렸다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "그러다 멈췄다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "나무가 우거진 언덕은 부자연스럽게 고요해졌다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "모든 소리가 하얀 껍질 아래에 짓눌려 묻힌 것처럼." },

    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "내 부츠가 길에 푹푹 박히며 낮은 소리를 냈다.", sfx: "footsteps" },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "너무 컸다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "주변에 들을 사람이 없다는 걸 알면서도." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 길은 사실 길이라고 할 것도 없었다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "인천 외곽 마을 위로, 나무 사이를 지나가는 좁은 얼어붙은 흙길이었다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "도시가 농지로 희미해지는 곳." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "바다 바람이 맨가지 사이로 불어오는 곳." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "가족이 대대로 그 근처에 살아야만 지도에 나오는 그런 길." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "나는 그 길을 여러 번 걸었다." },
    { bg: "/winter-letter/images/bg-road.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "코트 주머니에 칼을 넣고 걸은 적은 한 번도 없었다." },

    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "노인", text: "필요한 거라도?" },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "나", text: "그냥 보고 있는 겁니다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "노인", text: "여기엔 그냥 구경하러 오는 사람은 없는데." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "가게 주인은 안경이 너무 두꺼워서 눈이 얼굴에서 따로 떠 있는 것처럼 보였다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "렌즈 뒤에서 따로 떠 있는 것처럼." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "칼은 나무 손잡이였다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "약간 검은색." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "날은 12센티미터 조금 안 됐다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "가격을 기억한다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/oldman-neutral.png", name: "노인", text: "12,000원." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "정확히 12,000원." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그때는 너무 평범한 물건치고 비싸다고 생각했었다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "자루 근처에 작은 흠이 있었다. 금속이 제대로 다듬어지지 않은 부분." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "엄지손가락이 그 흠을 자주 찾았다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "장갑 속에서 그 흠을 계속 문지르고 있었다." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "칼이 진짜라는 것을 확인하려는 듯이." },
    { bg: "/winter-letter/images/bg-shop.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그저 의도에 불과한 것이 아니라는 듯이." },

    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "그래서 나는 걸었다.", sfx: "footsteps" },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "황혼이 일찍 찾아왔다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "겨울에는 늘 그렇다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "나무 사이로 빛이 희미해지며 모든 것이 물속에 잠긴 듯했다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "언덕 전체가 얼어붙은 바다 밑바닥으로 가라앉은 것처럼." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그때 그를 보았다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그는 길가에 서 있었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "오래전에 죽어 검은 발톱처럼 된 삼나무 근처에." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그는 특별한 일을 하고 있지 않았다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "지금 생각하면 그것이 가장 무섭다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그는 그저 서 있었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "편지를 읽고 있었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "모자가 이마 위로 살짝 젖혀져 있었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "빛이 희미해져서 얼굴 가까이 편지를 들고 있었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "한 번은 장갑 낀 손을 들어 종이에 묻은 눈을 털어냈다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아주 작은 동작이었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "너무 인간적이었다." },
    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "이미 뒤에서 다가오고 있는 것을 전혀 모르고 있었다." },

    { bg: "/winter-letter/images/bg-forest-dusk.jpg", char: "/winter-letter/images/stranger-back.png", name: "낯선 사람", text: "...?" },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "내 오른손이 움직였다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "칼이 그의 갈비뼈 아래로 들어갔다.", sfx: "stab" },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "내가 상상했던 바로 그곳이었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그 순간까지 내가 그런 상상을 했다는 것도 몰랐다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "처음에는 저항이 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "코트." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그 아래 셔츠." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그 후에는..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "아무것도 없었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "칼이 그를 뚫고 들어가는 것이 너무도 쉽고 추악해서 화가 날 정도였다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "살은 저항해야 한다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "뼈는 막아야 한다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "하지만 몸은 이미 강철을 받아들이기 위해 스스로 열려 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그는 편지를 떨어뜨렸다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "얼굴이 위로 향한 채 눈 위에 떨어졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "검은 글씨가 하얀 눈 위에 선명했다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그는 축축한 숨막힘 소리를 냈다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "우리는 함께 미끄러졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "내 부츠가 미끄러졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "우리 둘 다 넘어졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그가 넘어지면서 칼이 옆으로 찢어졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "따뜻한 것이 내 손 위로 터져 나왔다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "순간 내가 베인 줄 알았다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "하지만 그것은 그의 피였다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "장갑을 적시고." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "그 열기가 놀라웠다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-hurt.png", name: "나", text: "눈 위에 떨어지자 김이 피어올랐다." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "그리고 그는 나를 보았다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "증오도 없었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "두려움도 없었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "그저 혼란스러워했다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "끔찍하고 친밀한 당혹감." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "나를 어디선가 본 듯한 표정이었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "나", text: "그의 어린 시절이나 꿈속에 있었던 얼굴처럼." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/stranger-face.png", name: "낯선 사람", text: "...아..." },

    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "나는 한동안 그 위에 서 있었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "얼마나 오래였는지는 모른다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "언덕은 완전히 고요해졌다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "항구에서 불어오는 바람마저 물러난 듯했다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "이 일에 관여하고 싶지 않은 것처럼." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "내 숨이 창백한 구름이 되어 우리 위로 피어올랐다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "오른손에는 여전히 칼을 쥐고 있었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손목이 아프다는 것을 깨달았다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "칼을 찌른 탓이 아니었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손잡이를 너무 세게 움켜쥐고 있었기 때문이었다." },

    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그리고 실용적인 생각이 떠올랐다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "공포도 아니었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "후회도 아니었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그저 간단한 사실들의 나열이었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "시체가 드러나 있었다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "이 길은 영원히 비어 있지 않을 것이다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "누군가 올지도 모른다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그리고 누군가 오면..." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "이 모든 것이 현실이 된다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "나는 그의 발목을 잡고 끌었다.", sfx: "drag" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "생각보다 무거웠다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "무거운 짐. (Dead weight.)" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "사람들은 그 말을 가볍게 한다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "얼마나 문자 그대로인지는 모른다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그의 코트가 눈 아래 얼어붙은 뿌리에 걸렸다." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그의 머리가 돌에 부딪혔다.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "둔탁한 소리." },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "다시.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "또 다시.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-forest-night.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "그 소리는 지금도 나를 깨운다." },

    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "삼나무는 나무 더 깊은 곳에 서 있었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "죽어 있었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "오래전에 벼락을 맞아 갈라졌다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "한쪽 줄기가 썩어 있었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "뿌리가 갈비뼈처럼 땅 위로 솟아 있었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "땅이 더 부드러워 보였기 때문에 그곳을 선택했다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그렇지 않았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "서리가 흙을 벽돌처럼 단단하게 만들었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "삽이 없었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "먼저 나뭇가지를 사용했다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "부러졌다.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그 다음 칼을 썼다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "날이 살짝 휘었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그리고 맨손으로." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "추위가 너무 강렬해서 추위라는 느낌마저 사라졌다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그저 고통만 남았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손톱 아래로 흙이 들어갔다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손등의 피부가 갈라졌다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손끝 감각이 없었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "몇 번이고 멈췄다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "길에서 발소리가 들리는 것 같았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "하지만 그것은 내 심장 소리였다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "구멍은 너무 얕았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그를 내려놓으면서도 알았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그의 무릎이 펴지지 않았다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "한 팔이 등 아래로 꺾였다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "더 깊게 파려고 그를 끌어올릴 뻔했다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그때 그의 얼굴이 나를 향했다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "눈을 뜨고 있었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "눈 속에 눈이 녹아 들어갔다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "가슴속에서 무언가가 움츠러들었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "나는 두 손으로 흙을 퍼서 그 위에 덮었다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "너무 서둘렀다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그가 제대로 덮였는지도 거의 신경 쓰지 않았다." },

    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "한 번은..." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그의 손이 다시 나왔다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "손가락이 헐거운 흙을 헤치며 올라왔다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "도움을 청하는 듯이." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "나는 나뭇가지로 그 손을 내리쳤다." },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "한 번.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt-2.png", name: "나", text: "두 번.", sfx: "hit" },
    { bg: "/winter-letter/images/bg-cedar.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그것이 사라질 때까지." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "모든 것이 끝났을 때..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "나는 흐트러진 눈 위에 서 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "헐떡이며." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "진흙으로 뒤덮여 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "피로 뒤덮여 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "그리고..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "나는 웃기 시작했다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "웃긴 일이어서가 아니었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "고요함이 견딜 수 없었기 때문이었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "웃지 않았다면..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-hurt.png", name: "나", text: "온 언덕이 다 들을 정도로 비명을 지를 것 같았기 때문이었다." },

    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 다음 봄에 나는 이사를 갔다.", sfx: "train" },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "아무도 나를 찾아오지 않았다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그게 가장 이상한 부분이었다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "세상은 그 행위 주위로 재배치되지 않았다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "역 근처에서 호떡을 파는 아줌마는 여전히 매일 저녁 가판을 밝혔다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "교회 확성기는 일요일 아침마다 여전히 지직거렸다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아이들은 학교 운동장에서 반쯤 얼어붙은 축구공을 차고 놀았다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "형사는 나타나지 않았다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "수배 전단도 붙지 않았다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "실종된 여행자도 없었다." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "내가 죽인 그 남자는 처음부터 존재하지 않았던 것처럼." },
    { bg: "/winter-letter/images/bg-train.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그래서 나중에 사라졌다고 해도 아무도 알아차리지 못했다." },

    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "나", text: "처음에는 방 밖 발소리 하나하나에 귀를 기울였다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "문 두드리는 소리만 들어도 손이 저렸다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그날 입었던 코트를 태웠다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "칼을 뜨거운 물로 문질러 나무 손잡이가 갈라질 때까지 씻었다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그러던 어느 날 저녁..." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "하루 종일 그를 생각하지 않았다는 걸 깨달았다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "그게 살인보다 더 무서웠다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "마음은 무엇이든 소화할 수 있다는 뜻이었으니까." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "시간만 충분하면." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "세월이 흘렀다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아니면 몇 달." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "확실히 말할 수 없다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "세 군데 구역에서 살았다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아마 네 군데." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "이름도 모르는 건물의 작은 방들." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "말을 거의 하지 않아도 되는 일을 했다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-2.png", name: "나", text: "거울을 피했다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "꿈을 자주 꾸었다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "부츠 아래 눈." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "길 위의 편지." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral-3.png", name: "나", text: "너무 늦게 돌아보는 남자." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "하지만 깨어나는 것은 언제나 안도였다." },
    { bg: "/winter-letter/images/bg-room.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "어젯밤까지는." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "지금 내가 있는 방은 하숙집 3층이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "벽지는 녹색이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "난로 연기로 인해 오래된 멍처럼 어두워졌다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아래층 과부는 매일 밤 자정 조금 지나면 기침을 한다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "비가 오면 복도 마루가 부풀어 오른다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그래서 손잡이를 돌릴 때 문을 들어 올리지 않으면 열리지 않는다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "이런 세부 사항들이 중요하다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "이 모든 것이 실제 장소에서 일어났다는 증거이기 때문이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그저 열에 들뜬 꿈속이 아니라는 증거." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "노크 소리가 났다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "세 번.", sfx: "knock" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "부드럽게." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "예의 바르게." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "술 취한 사람의 거친 두드림이 아니었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "집주인도 아니었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "각 노크 사이의 간격이 정확히 같았다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "누군가 조용히 숫자를 세며 하는 것처럼." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아래층 과부의 기침이 멈췄다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "불이 작게 탁탁 소리를 냈다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그러자 온 집이 숨을 죽인 듯했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "문을 열었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "복도는 비어 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "저쪽 끝 램프가 깜빡였다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "발소리도 없었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "아무 소리도 없었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "고개를 숙여 보았다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "마루판 위에 봉투가 놓여 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "축축했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "종이 위에 얇은 습기가 번져 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "눈 속에 두고 온 것처럼." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "주소도 없었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "봉인도 없었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "한쪽 구석에 어두운 얼룩만 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "주우려고 몸을 숙였다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그리고 물러섰다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "종이가 따뜻했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "방 온도가 아니었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "살처럼 따뜻했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "살아 있는 것처럼 따뜻했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "안에는 한 장의 접힌 종이가 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 필체를 단번에 알아보았다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "한 번도 본 적 없었는데도." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 문장은 불가능하다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "하지만 사실이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "어떤 패턴은 눈으로 아는 것이 아니라." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "공포로 아는 것이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "첫 줄을 읽기도 전에 속이 뒤집혔다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "그 기울어진 선을 어디서 보았는지 깨달았기 때문이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "눈 위에 떨어져 있던 그 종이에서." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-neutral.png", name: "나", text: "내가 그를 죽이기 전에 그가 읽고 있던 그 편지에서." },

    // Letter parts
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/letter.png", name: "", text: "이 글을 읽고 있다면...", isLetter: true },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/letter.png", name: "", text: "나는 이미 너를 죽인 후다.", isLetter: true },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "나는 비명을 질렀다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "의도한 것이 아니었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "소리가 저절로 새어 나왔다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "뒤로 비틀거렸다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "등불을 넘어뜨렸다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "기름이 바닥에 쏟아졌다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "다행히 불은 붙지 않았다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "문에서 시선을 뗄 수 없었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "누군가 들어올 것 같았다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "눈으로 젖은 누군가." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "내가 얼어붙은 흙으로 덮었던 얼굴을 한 누군가." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "아무도 들어오지 않았다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "시간이 흘렀다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "아마 더 오래." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "결국..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "공포가 길어지면 강박이 된다..." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "나는 다시 편지를 집어 들었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "그리고 나머지를 읽었다." },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "너는 나를 모른다. 네가 나를 죽였다고 생각하지만.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "오히려 내가 몇 년 전부터 너를 선택했다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "네가 어떤 사람이 될지 알고 있었다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "네가 걸을 길을 알고 있었다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "네가 만날 낯선 이를 알고 있었다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "네가 들고 다닐 칼을 알고 있었다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "내가 그곳에 서 있었던 것은 이미 그렇게 써 두었기 때문이다.", isLetter: true },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "나는 항상 그렇게 써 왔다.", isLetter: true },

    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "맨 아래에는 마지막 한 줄이 있었다." },
    { bg: "/winter-letter/images/black.jpg", char: "/winter-letter/images/letter.png", name: "", text: "네 마루 밑을 보아라.", isLetter: true },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "도망쳤어야 했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "정상적인 사람이라면 도망쳤을 것이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "하지만 죄책감은 일종의 복종이다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "죽은 자의 고발에도 영혼이 대답하도록 훈련시킨다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "나는 쇠 부지깽이를 들었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "그리고 바닥을 내리쳤다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "한 번.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "두 번.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "세 번째로..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "판자가 갈라졌다.", sfx: "woodbreak" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "그 아래에 빈 공간이 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "누렇게 변한 이불보에 싸여..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "시체가 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "신선했다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "썩은 냄새가 나지 않았다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "해골도 아니었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "방금 죽은 듯한 남자였다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "창백한 피부." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "가슴에 좁은 상처 하나." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "손톱 아래 진흙이 끼어 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "그대로 얼어붙어 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "그것은 나였다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "내 얼굴." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "입이 살짝 벌어져 있었다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "왼쪽 눈썹 위 어린 시절 흉터." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "낯선 사람이 알 리 없는 흉터." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked.png", name: "나", text: "바로 나였다." },

    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "이 글을 쓰고 있는 지금..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "누군가 다시 노크하고 있다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "세 번.", sfx: "knock" },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "부드럽게." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "예의 바르게." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "그리고 문밖 마루가 삐걱거리는 소리와..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "문턱 너머 숨소리의 리듬으로..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "두 번째 심장처럼 스며든 이상한 확신으로..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "그가 바로 나라는 것을 안다." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "문이 열리면..." },
    { bg: "/winter-letter/images/bg-room-night.jpg", char: "/winter-letter/images/me-shocked-2.png", name: "나", text: "그는 편지를 들고 있을 것이다." },
];

// ====================== ENGINE ======================
let currentIndex = 0;
let typing = false;
let fullText = '';
let charIndex = 0;
let interval;
let currentLang = 'en'; // 'en' or 'ko'

const bgEl = document.getElementById('background');
const charEl = document.getElementById('character');
const nameEl = document.getElementById('namebox');
const textEl = document.getElementById('text');
const textboxEl = document.getElementById('textbox');
const letterBox = document.getElementById('letter-box');
const letterText = document.getElementById('letter-text');
const titleScreen = document.getElementById('title-screen');
const gameScreen = document.getElementById('game-screen');
const creditsScreen = document.getElementById('credits-screen');

const gameMusic = document.getElementById('bgMusic');
const titleMusic = document.getElementById('titleMusic');
const sfxPlayer = document.getElementById('sfx');

gameMusic.loop = true;
titleMusic.loop = true;

// Stop all music
function stopAllMusic() {
    gameMusic.pause();
    titleMusic.pause();
    gameMusic.currentTime = 0;
    titleMusic.currentTime = 0;
}

// Music
function playTitleMusic() {
    stopAllMusic();
    titleMusic.src = "/winter-letter/audios/title.ogg";
    titleMusic.play().catch(() => {});
}

function playGameMusic() {
    stopAllMusic();
    gameMusic.src = "/winter-letter/audios/wind.ogg";
    gameMusic.play().catch(() => {});
}

function playCreditsMusic() {
    stopAllMusic();
    titleMusic.src = "/winter-letter/audios/title.ogg";
    titleMusic.play().catch(() => {});
}

// SFX
function playSFX(name) {
    if (!name || !sfxPlayer) return;
    sfxPlayer.src = `/winter-letter/audios/${name}.ogg`;
    sfxPlayer.currentTime = 0;
    sfxPlayer.play().catch(() => {});
    sfxPlayer.onended = () => {
        sfxPlayer.pause();
        sfxPlayer.currentTime = 0;
    };
}

// Preload backgrounds
function preloadBackgrounds() {
    const uniqueBgs = [...new Set(story.map(line => line.bg).filter(Boolean))];
    uniqueBgs.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// Language System
function getCurrentStory() {
    return currentLang === 'ko' ? storyKO : story;
}

function updateMenu() {
    const links = document.querySelectorAll('.top-menu a');
    if (links[0]) links[0].textContent = currentLang === 'ko' ? "시작" : "START";
    if (links[1]) links[1].textContent = currentLang === 'ko' ? "영어" : "KOREAN";
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ko' : 'en';
    updateMenu();
}

// Typewriter
function typeText(text, isLetter = false) {
    clearInterval(interval);
    if (isLetter) letterText.textContent = '';
    else textEl.textContent = '';
    fullText = text;
    charIndex = 0;
    typing = true;
    interval = setInterval(() => {
        if (charIndex < fullText.length) {
            if (isLetter) letterText.textContent += fullText.charAt(charIndex);
            else textEl.textContent += fullText.charAt(charIndex);
            charIndex++;
        } else {
            clearInterval(interval);
            typing = false;
        }
    }, 32);
}

function showLine() {
    const currentStory = getCurrentStory();
    if (currentIndex >= currentStory.length) {
        endGame();
        return;
    }
    const line = currentStory[currentIndex];

    if (line.bg) bgEl.style.backgroundImage = `url('${line.bg}')`;

    if (line.char && charEl) {
        charEl.src = line.char;
        charEl.style.opacity = '1';
    } else if (charEl) {
        charEl.style.opacity = '0';
    }

    if (line.isLetter) {
        textboxEl.style.display = 'none';
        letterBox.style.display = 'block';
        typeText(line.text, true);
    } else {
        textboxEl.style.display = 'block';
        letterBox.style.display = 'none';
        nameEl.textContent = line.name || '';
        if (!line.name) textboxEl.classList.add('narration');
        else textboxEl.classList.remove('narration');
        typeText(line.text, false);
    }

    if (line.sfx) playSFX(line.sfx);
}

function endGame() {
    gameScreen.style.transition = 'opacity 1.8s ease';
    gameScreen.style.opacity = '0';

    setTimeout(() => {
        gameScreen.style.display = 'none';
        creditsScreen.style.display = 'flex';
        setTimeout(() => { creditsScreen.style.opacity = '1'; }, 50);
        playCreditsMusic();
    }, 1800);
}

function returnToTitle() {
    window.location.reload();
}

function startGame() {
    titleScreen.style.opacity = '0';
    setTimeout(() => {
        titleScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        playGameMusic();
        currentIndex = 0;
        showLine();
    }, 1200);
}

// Initialize
window.addEventListener('load', () => {
    playTitleMusic();
    preloadBackgrounds();
    updateMenu();
});

document.addEventListener('click', () => {
    if (titleMusic.paused && titleScreen.style.display !== 'none') {
        playTitleMusic();
    }
}, { once: true });

// Click handlers
textboxEl.addEventListener('click', () => {
    if (typing) {
        clearInterval(interval);
        textEl.textContent = fullText;
        typing = false;
    } else {
        currentIndex++;
        showLine();
    }
});

letterBox.addEventListener('click', () => {
    if (typing) {
        clearInterval(interval);
        letterText.textContent = fullText;
        typing = false;
    } else {
        currentIndex++;
        showLine();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (typing) {
            clearInterval(interval);
            if (letterBox.style.display === 'block') letterText.textContent = fullText;
            else textEl.textContent = fullText;
            typing = false;
        } else {
            currentIndex++;
            showLine();
        }
    }
});
