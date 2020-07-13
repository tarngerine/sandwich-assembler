const SandwichState = {
  curPlayerId: 0,
  roundId: 0,
  totalRounds: 3,
  ingredients: [],
  scores: [],
  timer: -1,
  roundInProgress: false,
  finished: false,
  result: new Image(),
};

// module aliases/globals/constants
const Engine = Matter.Engine,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Events = Matter.Events,
  Composites = Matter.Composites,
  Composite = Matter.Composite,
  Body = Matter.Body,
  Mouse = Matter.Mouse,
  MouseConstraint = Matter.MouseConstraint,
  Render = Matter.Render,
  Runner = Matter.Runner,
  WIDTH = 800,
  HEIGHT = 600,
  worldCanvas = document.getElementById('world');

// Matter.js physics setup
const engine = Engine.create(),
  world = engine.world; // other code relies on this defined global... cannot remove
const render = Render.create({
  canvas: worldCanvas,
  engine: engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    wireframes: false, // comment to show wires
    background: 'transparent'
  }
});
Render.run(render);

// update loop??
const runner = Runner.create();
Runner.run(runner, engine);

// bounds
const t = 20,
boundOpts = {
  isStatic: true,
  friction: 10,
  frictionStatic: 10,
};

World.add(world, [
  Bodies.rectangle(WIDTH / 2, HEIGHT + t/2, WIDTH * 2, t, boundOpts),
  // draw walls?
  // Bodies.rectangle(-t, HEIGHT / 2, t, HEIGHT, boundOpts),
  // Bodies.rectangle(WIDTH + t, HEIGHT / 2, t, HEIGHT, boundOpts),
]);

const particleR = 8;
const breadCol = Math.floor((WIDTH-200) / (particleR*2));
const createBread = (density = 4) => {
  return Composites.softBody(
    100, 0, // x y
    breadCol, 3, // col row
    0, 0, // x y gap
    true, particleR, // cross brace constraint, radius of particle, particle options
    { 
      density: density,
      friction: 1,
      frictionStatic: 10,
      slop: .1,
      restitution: 0,
      render: {
        fillStyle: 'brown'
      }
    }, { // constraint style
      damping: .1,
      stiffness: .5,
      render: {
        strokeStyle: 'brown'
      }
    });
}
const bottomBread = createBread();
World.add(world, bottomBread);
// freeze bottom bread after x seconds
// setTimeout(() => {
//   Composite.allBodies(bottomBread).forEach(b => b.isStatic = true);
// }, 3000)

const imageCanvas = document.createElement('canvas');
imageCanvas.width = 400;
imageCanvas.height = 400;
// document.body.prepend(imageCanvas); // uncomment to DEBUG

// gets a vertex for the bounds of a drawing by marching in
// from an an edge/corner until it finds an opaque pixel
const getImageBoundVertex = (ctx, img, x, y, xRate, yRate) => {
  let step = 10;
  while (x >= 0 && y >= 0 && x < img.width && y < img.height) {
    const pixels = ctx.getImageData(x, y, step, step).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i+3] > 200) {
        return {
          x: x,
          y: y
        }
      }
    }
    x += xRate * step;
    y += yRate * step;
  }
}

const loadImageUrl = (url, pos) => {
  const img = new Image();
  img.onload = () => {
    const ctx = imageCanvas.getContext('2d'),
    w = img.width,
    h = img.height, 
    vertices = [];
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.drawImage(img, 0, 0);

    const nw = getImageBoundVertex(ctx, img, 0, 0, 1, 1),
      n = getImageBoundVertex(ctx, img, Math.floor(w/2), 0, 0, 1),
      ne = getImageBoundVertex(ctx, img, w - 1, 0, -1, 1),
      e = getImageBoundVertex(ctx, img, w - 1, Math.floor(h / 2), -1, 0),
      se = getImageBoundVertex(ctx, img, w - 1, h - 1, -1, -1),
      s = getImageBoundVertex(ctx, img, Math.floor(w / 2), h - 1, 0, -1),
      sw = getImageBoundVertex(ctx, img, 0, h - 1, 1, -1),
      west = getImageBoundVertex(ctx, img, 0, Math.floor(h / 2), 1, 0);

    // clockwise from top
    // TODO: check for concave hull based on angles?
    const exists = (v2) => {
      if (v2) {
        return !vertices.some(v1 => v1.x == v2.x && v1.y == v2.y);
      }
    }
    if (exists(nw)) vertices.push(nw); 
    if (exists(n)) vertices.push(n);
    if (exists(ne)) vertices.push(ne);
    if (exists(e)) vertices.push(e);
    if (exists(se)) vertices.push(se);
    if (exists(s)) vertices.push(s);
    if (exists(sw)) vertices.push(sw);
    if (exists(west)) vertices.push(west);

    // debug draw points on canvas
    // vertices.forEach((v, i) => {
    //   ctx.fillText(`${i}: ${v.x}, ${v.y}`, v.x, v.y)
    //   ctx.fillRect(v.x, v.y, 5, 5)
    // });

    const hull = Matter.Vertices.hull(vertices);
    const chamfered = Matter.Vertices.chamfer(hull, 10);

    const body = Bodies.fromVertices(
      pos ? pos.x : WIDTH / 2,
      pos ? pos.y : -200,
      chamfered, {
      density: 1,
      friction: 10,
      frictionStatic: 10,
      restitution: .01,
      render: {
        fillStyle: 'transparent',
        sprite: {
          texture: img.src,
          xScale: .9, // should be 1 but tweaking it to make it look better
          yScale: .9,
        }
      }
    },
      false, // flagInternal
      1 // removeCollinear default .01, increase to remove redundant vertices
    );

    World.add(world, body);
    SandwichState.ingredients.push(body);
  };
  img.src = url;
};

// Autospawn 
// setTimeout(() => {
//   for (let i = 1; i < 8; i++) {
//     setTimeout(() => {
//       loadImageUrl(`img/${i}.png`);
//     }, 500*i);
//   }
// }, 1000)

// add mouse control
const mouse = Mouse.create(render.canvas),
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: true
      }
    }
  });
World.add(world, mouseConstraint);
// keep the mouse in sync with rendering
render.mouse = mouse;

// spawn on click
Matter.Events.on(mouseConstraint, "mouseup", e => {
  // Allow 1 ingredient per round
  if (SandwichState.ingredients.length >= SandwichState.roundId) return;
  const randomImage = `img/${Math.floor(Math.random() * Math.floor(6)) + 1}.png`;
  loadImageUrl(randomImage, {
    x: e.mouse.position.x,
    y: 0, // all drops from the same height
  });
  SandwichState.timer = 0; // skip to end of round
});

const score = () => {
  // Calculate score
  const breadBounds = Composite.bounds(bottomBread);
  SandwichState.ingredients.forEach(body => {
    const cent = ((body.bounds.max.x - body.bounds.min.x) / 2) +  body.bounds.min.x;
    if (cent > breadBounds.min.x && cent < breadBounds.max.x) {
      SandwichState.scores.push(1);
    } else {
      SandwichState.scores.push(0);
    }
  });

  let scoreStr = '';
  SandwichState.scores.forEach((s, i) => {
    scoreStr += `Round ${i+1}: ${s > 0 ? '✅' : ''}\n`
  })

  return scoreStr;
}

// timer to drop top bread and freeze
const timer = document.createElement('div');
let duration = 4;
timer.innerHTML = `Click to start round 1 of ${SandwichState.totalRounds}`;
document.body.prepend(timer);
const startButton = document.createElement('button');
startButton.innerText = 'Start round';
document.body.prepend(startButton);
startButton.addEventListener('click', e => SandwichState.roundInProgress = true);
const clock = setInterval(() => {
  if (SandwichState.timer == -1 && !SandwichState.finished) {
    // new round
    SandwichState.roundId++;
    SandwichState.timer = duration;
  } else if (SandwichState.timer > 0 && SandwichState.roundInProgress) {
    // same round, advance timer
    SandwichState.timer--;
    timer.innerHTML = `Round ${SandwichState.roundId} — ${SandwichState.timer}s left`;;
  } else if (SandwichState.timer == 0) {
    // timer ending
    SandwichState.timer = -1;
    SandwichState.roundInProgress = false;

    // round finished
    timer.innerHTML = "Round finished"

    // game finished
    if (SandwichState.roundId == SandwichState.totalRounds) {
      SandwichState.finished = true;
      World.add(world, createBread(1)); // low density top bread
      setTimeout(() => {
        Render.stop(render);
        const ctx = worldCanvas.getContext('2d');
        ctx.font = "32px Chalkboard"
        ctx.fillText('Great sandwich!!', 100, 100);
        SandwichState.result.src = worldCanvas.toDataURL();
        ctx.fillText('Scores', 100, 140);
        ctx.fillText(score(), 100, 180);
      }, 3000);
    }
  }
}, 1000);