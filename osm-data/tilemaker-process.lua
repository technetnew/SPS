-- Simple tilemaker process file for basic OSM rendering
-- This creates a minimal but functional map

function node_function()
    local place = Find("place")
    local name = Find("name")

    if place ~= "" and name ~= "" then
        Layer("place", false)
        Attribute("name", name)
        Attribute("class", place)
        MinZoom(10)
    end
end

function way_function()
    local highway = Find("highway")
    local waterway = Find("waterway")
    local water = Find("water")
    local natural = Find("natural")
    local name = Find("name")

    -- Roads
    if highway ~= "" then
        Layer("transportation", false)
        Attribute("class", highway)
        if name ~= "" then
            Attribute("name", name)
        end

        -- Set zoom levels based on road importance
        if highway == "motorway" or highway == "trunk" then
            MinZoom(6)
        elseif highway == "primary" then
            MinZoom(8)
        elseif highway == "secondary" then
            MinZoom(10)
        else
            MinZoom(12)
        end
    end

    -- Water features
    if waterway ~= "" or water == "river" or water == "lake" or natural == "water" then
        Layer("water", true)
        if name ~= "" then
            Attribute("name", name)
        end
        Attribute("class", waterway ~= "" and waterway or natural)
        MinZoom(8)
    end
end
