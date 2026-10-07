import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

export default function Poems({ onClose }) {
  const [wordWrap, setWordWrap] = useState(true);

  function onClickOptionItem(item) {
    switch (item) {
      case "Exit":
      case "Close":
        onClose?.();
        break;
      case "Word Wrap":
        setWordWrap(w => !w);
        break;
      default:
    }
  }

  const poemsText = useMemo(
    () => `Chrysalis of Light

The walls close in like iron ribs,
a cage of silk and trembling dark.
No air, no sky—only the weight
of what I was,
twisting, breaking, melting down.

Inside this husk, I am unmade,
dissolved in fire and aching marrow.
Bones crack like branches in a storm,
feathers claw through tender skin—
each one a needle, a wound, a prayer.

I scream, but no one hears—
no voice escapes the chrysalis.
Only the sound of splintering past,
the shudder of flesh becoming light.

And then—
when the agony is all I am,
when even pain begins to fade—
the shell splits open like a wound,
and I spill into the sky.

Not broken, not whole,
but something new,
wings soaked in the blood of rebirth,
eyes open to the weightless dawn.

────────────────────────────────────────────

Rising from Ashes

In the myriad of serpentine thoughts,
As I am losing grip
On the sanity I’ve been trying to hold.

Like an open-ended question,
Answers don’t come quick.
The suppressed pains of distrust
Lurk in my being anytime they want.

My whole being longs
For an absolution.
These apocalyptic thoughts
Keep marauding my silence.

I may smile
Despite each tear,
But like fragile glass,
I could melt into my being.

Like a reborn Phoenix,
I shall rise from ashes
And let healing come—
Like dawn on a new day.

With a clean slate,
I will rise above it all,
For resiliency is embedded
Deep into my core.

────────────────────────────────────────────

If I Forget

If I forget your name one day,
Please know I’d never turn away.
My mind may drift, my thoughts may slow,
But in my heart, I still will know.

If stories fade or come out wrong,
And silence takes the place of song,
Just sit with me, don’t rush to speak—
Your presence gives me all I seek.

There may be times I seem unsure,
A knock without a name or door.
But something in your touch, your tone—
It tells me I’m not quite alone.

You might repeat the same reply,
Watch questions circle, pass you by.
Still answer kind—still take my hand—
I’m doing all I understand.

And if I lose the words to say
"I love you" in the usual way,
Please hear it in a quiet sigh,
A glance, a tear, a heavy eye.

Though memory may come and go,
The soul remembers what it knows.
So stay with me, and you will see:
The heart holds on, even if I can't be.

────────────────────────────────────────────

The Edge of Meaning

The world is all that is the case—
each moment held in time and place.
Not hidden realms or inner grace,
but just the facts we learn to face.

We speak in signs, we build with care
a model of the world out there.
But some things—love, or what is true—
no sentence ever quite gets through.

Where words fall short, we start to feel
that silence frames what’s most real.
And so, beyond the things we say,
we live, we look, and walk away.

────────────────────────────────────────────

Sweetness of the Grave

She waited there in torn lace, still—
With maggots curling at their fill.
A smile clung faint to withered lips,
As rot dripped slow from fingertips.

Her hair hung limp in brittle strands,
And yet I knelt to take her hands.
The skin tore soft, like fragile leaf—
But love holds fast beneath our grief.

I kissed her mouth, the teeth laid bare,
Where something sweet and rank hung there—
A scent that held me, rich, unclean,
Like roses drowned in gasoline.

No breath remained, no pulse to chase—
Yet in that hush, I found her face.
The warmth of life had fled her chest,
But death, perhaps, had brought her rest.

A worm had bored through jaw and cheek.
She couldn’t cry. She couldn’t speak.
Yet still I heard her call me near—
A voice inside no one could hear.

I pressed my lips to cooling skin,
So soft it peeled and welcomed in.
Her blackened tongue brushed up to mine—
We danced beneath the granite sign.

I know it’s wrong. I know the stain.
But grief and longing twist the brain.
And though she’s dust, though time has passed,
I love her more than at the last.

────────────────────────────────────────────

After You

I still check my phone
Like your name might light up,
Like the story might change
If I believe hard enough.

But it doesn’t.
You’re still gone.
And I’m still here,
Tracing your outline in the dust
You left behind.

I replay our last conversation
Like a scratched record,
Listening for what I missed–
A tremor,
A hint,
A goodbye
Disguised as “I’m fine.”

I wasn’t ready.
You didn’t wait.
And now I’m left
Learning how to live
With a wound
That won’t clot.

People tell me to heal,
To find peace,
To move forward.

But I don’t want forward.
I want you
To be back,
Making everything
Feel less heavy.

Now, everything is heavier.
The days.
The quiet.
The places
Where you should still be.

But I carry you.
In the songs you loved.
In the jokes you ruined.
In the stillness
Where your voice should be.

This grief isn’t a wall–
It’s a thread.
I follow it back to you
Every time I close my eyes.
And when I cry,
It’s not for the end–
It’s for all the moments
You never got to stay for.

────────────────────────────────────────────

Echoes Between Us

I’m still here, somehow.
The world didn’t stop when she drifted away,
though I swore it should have.
Her laughter lingers in quiet corners,
her words hang in spaces
only I can feel.

I chase shadows of her in fleeting moments,
every memory carrying the warmth
I thought I’d never need to let go of.

They say time heals,
but it only teaches me to live
with the hollow echoes
of smiles I can’t touch
and moments I can’t hold.

I still turn, expecting her,
pause mid-thought as if she’ll answer,
reach toward her
in the spaces where she used to be.

Maybe love doesn’t end—
it just drifts,
like smoke through an empty room,
a presence felt, never grasped.

She’s everywhere still,
in every quiet light,
in every silent corner
where I used to find her.

────────────────────────────────────────────

I Ought to Be Thy Adam

I was born from hands that trembled with dreams,
stitched together by lightning and longing.
Your eyes, when they met mine,
did not see a soul—
only the shadow of your own sin.

You called me devil,
and so I learned to burn.
You turned away,
and so I learned the silence of the unloved.

Was I not made from your hope?
Was I not your child of wonder?
Yet you fled, leaving me to wander
in a world that mirrors your fear.

I reached for light,
but the sun recoiled.
I spoke, and the echoes shamed me.
I loved, and my love was met with horror.

You made me human in form,
but denied me the heart’s belonging.
You gave me life,
but not a name.
And in your absence,
I found the shape of my own grief.

If I am a monster,
it is because you would not touch me.
If I destroy,
it is because you taught me despair.

Still, I do not hate you—
I only wish to be seen.
To have someone call me beautiful,
if only for a breath.
To rest, once, in the warmth of being known.

For even monsters remember
the gentleness they were promised.
And even I—
born of your ambition,
forged in your rejection—
still dream
of love that does not flee.
`,
    [],
  );

  return (
    <Div>
      <section className="np__toolbar">
        <WindowDropDowns items={dropDownData} onClickItem={onClickOptionItem} />
      </section>

      <StyledTextarea
        readOnly
        wordWrap={wordWrap}
        value={poemsText}
        spellCheck={false}
      />
    </Div>
  );
}

const Div = styled.div`
  height: 100%;
  background: linear-gradient(to right, #edede5 0%, #ede8cd 100%);
  display: flex;
  flex-direction: column;
  align-items: stretch;

  .np__toolbar {
    position: relative;
    height: 21px;
    flex-shrink: 0;
    border-bottom: 1px solid white;
  }
`;

const StyledTextarea = styled.textarea`
  flex: auto;
  outline: none;
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.35;
  resize: none;
  padding: 10px;
  overflow-y: scroll;
  border: 1px solid #96abff;
  background: #fff;
  color: #000;

  ${({ wordWrap }) =>
    wordWrap ? "" : "white-space: nowrap; overflow-x: scroll;"}
`;
