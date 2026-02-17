function circleCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const radSum = a.radius + b.radius;
  return distSq <= radSum * radSum;
}

function circleRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
}

function resolveCircleCircle(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) {
    // Push apart in random direction
    a.x -= 1;
    b.x += 1;
    return;
  }
  const overlap = (a.radius + b.radius) - dist;
  if (overlap <= 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const totalMass = a.radius + b.radius;
  const aRatio = b.radius / totalMass;
  const bRatio = a.radius / totalMass;

  a.x -= nx * overlap * aRatio;
  a.y -= ny * overlap * aRatio;
  b.x += nx * overlap * bRatio;
  b.y += ny * overlap * bRatio;
}

function resolveCircleRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    // Circle center is inside rect, push to nearest edge
    const distLeft = circle.x - rect.x;
    const distRight = (rect.x + rect.width) - circle.x;
    const distTop = circle.y - rect.y;
    const distBottom = (rect.y + rect.height) - circle.y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) circle.x = rect.x - circle.radius;
    else if (minDist === distRight) circle.x = rect.x + rect.width + circle.radius;
    else if (minDist === distTop) circle.y = rect.y - circle.radius;
    else circle.y = rect.y + rect.height + circle.radius;
    return;
  }

  const overlap = circle.radius - dist;
  if (overlap <= 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  circle.x += nx * overlap;
  circle.y += ny * overlap;
}

module.exports = { circleCircle, circleRect, resolveCircleCircle, resolveCircleRect };
