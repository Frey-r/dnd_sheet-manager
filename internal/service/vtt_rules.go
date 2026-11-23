package service

import (
	"math"
	"regexp"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// MovementBlocked reports whether the straight path from (x1,y1) to (x2,y2)
// crosses a wall that currently blocks movement (openspec/specs/vtt.md §3).
func MovementBlocked(walls []domain.Wall, x1, y1, x2, y2 float64) bool {
	for _, w := range walls {
		if !w.Blocks() {
			continue
		}
		if segmentsIntersect(x1, y1, x2, y2, w.X1, w.Y1, w.X2, w.Y2) {
			return true
		}
	}
	return false
}

// SlideMove moves from (x1,y1) toward (x2,y2); when a wall blocks the direct step it slides
// along one axis, and stays put when both axes are blocked.
func SlideMove(walls []domain.Wall, x1, y1, x2, y2 float64) (float64, float64) {
	if !MovementBlocked(walls, x1, y1, x2, y2) {
		return x2, y2
	}
	if x2 != x1 && !MovementBlocked(walls, x1, y1, x2, y1) {
		return x2, y1
	}
	if y2 != y1 && !MovementBlocked(walls, x1, y1, x1, y2) {
		return x1, y2
	}
	return x1, y1
}

func orient(ax, ay, bx, by, cx, cy float64) float64 {
	return (bx-ax)*(cy-ay) - (by-ay)*(cx-ax)
}

func onSegment(ax, ay, bx, by, px, py float64) bool {
	return min(ax, bx) <= px && px <= max(ax, bx) && min(ay, by) <= py && py <= max(ay, by)
}

func segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy float64) bool {
	d1 := orient(cx, cy, dx, dy, ax, ay)
	d2 := orient(cx, cy, dx, dy, bx, by)
	d3 := orient(ax, ay, bx, by, cx, cy)
	d4 := orient(ax, ay, bx, by, dx, dy)
	if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)) {
		return true
	}
	switch {
	case d1 == 0 && onSegment(cx, cy, dx, dy, ax, ay):
		return true
	case d2 == 0 && onSegment(cx, cy, dx, dy, bx, by):
		return true
	case d3 == 0 && onSegment(ax, ay, bx, by, cx, cy):
		return true
	case d4 == 0 && onSegment(ax, ay, bx, by, dx, dy):
		return true
	}
	return false
}

// DarkvisionForRace returns the default darkvision range (feet) of a 5e race name,
// matching Spanish and English names. Unknown or homebrew races return 0.
func DarkvisionForRace(race string) int {
	r := strings.ToLower(race)
	switch {
	case strings.Contains(r, "drow") || strings.Contains(r, "duergar") || strings.Contains(r, "svirfneblin") || strings.Contains(r, "gnomo de las profundidades") || strings.Contains(r, "deep gnome"):
		return 120
	case strings.Contains(r, "elf"), strings.Contains(r, "elfo"), strings.Contains(r, "dwarf"), strings.Contains(r, "enan"),
		strings.Contains(r, "gnom"), strings.Contains(r, "orc"), strings.Contains(r, "orco"), strings.Contains(r, "tiefling"),
		strings.Contains(r, "goblin"), strings.Contains(r, "kobold"), strings.Contains(r, "tabaxi"), strings.Contains(r, "aasimar"),
		strings.Contains(r, "genasi"):
		return 60
	}
	return 0
}

var senseRe = regexp.MustCompile(`(?i)(darkvision|blindsight|visión en la oscuridad|vista ciega)\s*(\d+)`)

// ParseSenses extracts darkvision and blindsight ranges (feet) from a monster's
// senses text, e.g. "blindsight 60 ft., darkvision 120 ft., passive Perception 23".
func ParseSenses(senses string) (darkvision, blindsight int) {
	for _, m := range senseRe.FindAllStringSubmatch(senses, -1) {
		n, err := strconv.Atoi(m[2])
		if err != nil {
			continue
		}
		switch strings.ToLower(m[1]) {
		case "darkvision", "visión en la oscuridad":
			darkvision = max(darkvision, n)
		default:
			blindsight = max(blindsight, n)
		}
	}
	return darkvision, blindsight
}

// SnapToGrid moves a point to the centre of the grid cell that contains it,
// honouring the grid offset and the token size (even sizes snap to intersections).
func SnapToGrid(x, y float64, cell, offX, offY int, sizeCells float64) (float64, float64) {
	if cell <= 0 {
		return x, y
	}
	c := float64(cell)
	half := 0.0
	if int(sizeCells+0.5)%2 == 1 || sizeCells < 1 {
		half = c / 2
	}
	sx := float64(offX) + half + c*math.Round((x-float64(offX)-half)/c)
	sy := float64(offY) + half + c*math.Round((y-float64(offY)-half)/c)
	return sx, sy
}
