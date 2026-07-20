"""Generate the small, original IFC4 sample building used by the digital
twin's BIM import demo — written from scratch with ifcopenshell, not sourced
from a third-party sample file, so there's no license to verify (this is our
own content, same discipline as everything else CC0/original in this repo).

Two-storey rectangular main block plus a single-storey wing, echoing the
footprint of the procedural schematic twin (frontend/src/lib/twinDimensions.ts)
without needing to match it exactly — the point is to exercise a real IFC
parse (web-ifc), not to mirror the placeholder geometry.

Usage: pip install ifcopenshell && python scripts/gen_demo_building_ifc.py
Writes frontend/public/models/demo-building.ifc.
"""

import math
import pathlib

import ifcopenshell
import ifcopenshell.api.aggregate
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.root
import ifcopenshell.api.spatial
import ifcopenshell.api.unit
import ifcopenshell.util.placement

OUT_PATH = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public" / "models" / "demo-building.ifc"

STOREY_HEIGHT = 3.2
WALL_THICKNESS = 0.2
WALL_HEIGHT = STOREY_HEIGHT - 0.3

# Main block footprint (10m x 8m) + a lower wing (5m x 5m) on the east side.
MAIN_W, MAIN_D = 10.0, 8.0
WING_W, WING_D = 5.0, 5.0

MAIN_PERIMETER = [(0.0, 0.0), (MAIN_W, 0.0), (MAIN_W, MAIN_D), (0.0, MAIN_D), (0.0, 0.0)]
WING_PERIMETER = [(MAIN_W, 0.0), (MAIN_W + WING_W, 0.0), (MAIN_W + WING_W, WING_D), (MAIN_W, WING_D)]


def main() -> None:
    ifc = ifcopenshell.file(schema="IFC4")

    ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcProject", name="PunchList AI Demo Building")
    length_unit = ifcopenshell.api.unit.add_si_unit(ifc, unit_type="LENGTHUNIT")  # plain metres, no milli prefix
    area_unit = ifcopenshell.api.unit.add_si_unit(ifc, unit_type="AREAUNIT")
    volume_unit = ifcopenshell.api.unit.add_si_unit(ifc, unit_type="VOLUMEUNIT")
    ifcopenshell.api.unit.assign_unit(ifc, units=[length_unit, area_unit, volume_unit])

    model_ctx = ifcopenshell.api.context.add_context(ifc, context_type="Model")
    body_ctx = ifcopenshell.api.context.add_context(
        ifc, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=model_ctx
    )

    project = ifc.by_type("IfcProject")[0]
    site = ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcSite", name="Site")
    building = ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcBuilding", name="Riverside Build")
    ifcopenshell.api.aggregate.assign_object(ifc, relating_object=project, products=[site])
    ifcopenshell.api.aggregate.assign_object(ifc, relating_object=site, products=[building])

    storeys = []
    for i, label in enumerate(["Ground Floor", "Level 1"]):
        storey = ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcBuildingStorey", name=label)
        storey.Elevation = i * STOREY_HEIGHT
        ifcopenshell.api.aggregate.assign_object(ifc, relating_object=building, products=[storey])
        storeys.append(storey)

    def add_walls_for_perimeter(points, storey, elevation, name_prefix):
        for i in range(len(points) - 1):
            p1, p2 = points[i], points[i + 1]
            wall = ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcWall", name=f"{name_prefix} wall {i}")
            ifcopenshell.api.spatial.assign_container(ifc, relating_structure=storey, products=[wall])
            length = math.dist(p1, p2)
            representation = ifcopenshell.api.geometry.add_wall_representation(
                ifc, context=body_ctx, length=length, height=WALL_HEIGHT, thickness=WALL_THICKNESS
            )
            ifcopenshell.api.geometry.assign_representation(ifc, product=wall, representation=representation)
            angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
            matrix = ifcopenshell.util.placement.a2p(
                (p1[0], p1[1], elevation), (0.0, 0.0, 1.0), (math.cos(angle), math.sin(angle), 0.0)
            )
            ifcopenshell.api.geometry.edit_object_placement(ifc, product=wall, matrix=matrix)

    def add_slab(points, storey, elevation, name):
        slab = ifcopenshell.api.root.create_entity(ifc, ifc_class="IfcSlab", name=name)
        ifcopenshell.api.spatial.assign_container(ifc, relating_structure=storey, products=[slab])
        profile = ifc.createIfcArbitraryClosedProfileDef(
            ProfileType="AREA",
            OuterCurve=ifc.createIfcPolyline([ifc.createIfcCartesianPoint(p) for p in points]),
        )
        solid = ifc.createIfcExtrudedAreaSolid(
            SweptArea=profile,
            Position=ifc.createIfcAxis2Placement3D(ifc.createIfcCartesianPoint((0.0, 0.0, 0.0))),
            ExtrudedDirection=ifc.createIfcDirection((0.0, 0.0, 1.0)),
            Depth=0.25,
        )
        shape = ifc.createIfcShapeRepresentation(
            ContextOfItems=body_ctx, RepresentationIdentifier="Body", RepresentationType="SweptSolid", Items=[solid]
        )
        ifcopenshell.api.geometry.assign_representation(ifc, product=slab, representation=shape)
        matrix = ifcopenshell.util.placement.a2p((0.0, 0.0, elevation), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))
        ifcopenshell.api.geometry.edit_object_placement(ifc, product=slab, matrix=matrix)

    for i, storey in enumerate(storeys):
        elevation = i * STOREY_HEIGHT
        add_walls_for_perimeter(MAIN_PERIMETER, storey, elevation, "Main")
        if i == 0:
            # Wing is a single-storey annex, ground floor only.
            add_walls_for_perimeter(WING_PERIMETER + [WING_PERIMETER[0]], storey, elevation, "Wing")
        add_slab(MAIN_PERIMETER[:-1], storey, elevation, f"{storey.Name} slab")
        if i == 0:
            add_slab(WING_PERIMETER, storey, elevation, "Wing slab")

    # Roof slabs: over the main block at the top of level 1, and over the
    # single-storey wing at its own top.
    add_slab(MAIN_PERIMETER[:-1], storeys[-1], STOREY_HEIGHT * 2, "Roof")
    add_slab(WING_PERIMETER, storeys[0], STOREY_HEIGHT, "Wing roof")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ifc.write(str(OUT_PATH))
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
