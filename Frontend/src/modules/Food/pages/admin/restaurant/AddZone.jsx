import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapPin, ArrowLeft, Save, X, Search, Compass, RefreshCw, AlertCircle } from "lucide-react"
import { adminAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
import { toast } from "sonner"

const LIBRARIES = ["places", "geometry"]

// Helper to generate a 4-point bounding box polygon around the selected point coordinates (for backend polygon compat)
const generateBoundingBox = (lat, lng, radiusKm = 5) => {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
  
  return [
    { latitude: parseFloat((lat - latDelta).toFixed(6)), longitude: parseFloat((lng - lngDelta).toFixed(6)) },
    { latitude: parseFloat((lat + latDelta).toFixed(6)), longitude: parseFloat((lng - lngDelta).toFixed(6)) },
    { latitude: parseFloat((lat + latDelta).toFixed(6)), longitude: parseFloat((lng + lngDelta).toFixed(6)) },
    { latitude: parseFloat((lat - latDelta).toFixed(6)), longitude: parseFloat((lng + lngDelta).toFixed(6)) },
    { latitude: parseFloat((lat - latDelta).toFixed(6)), longitude: parseFloat((lng - lngDelta).toFixed(6)) }
  ]
}

// Helper to find the center of coordinates for legacy polygon zones
const getPolygonCenter = (coords) => {
  if (!coords || coords.length === 0) return { lat: 20.5937, lng: 78.9629 }
  let sumLat = 0
  let sumLng = 0
  let count = 0
  coords.forEach(c => {
    const lat = c.latitude ?? c.lat
    const lng = c.longitude ?? c.lng
    if (lat != null && lng != null) {
      sumLat += lat
      sumLng += lng
      count++
    }
  })
  if (count === 0) return { lat: 20.5937, lng: 78.9629 }
  return { lat: sumLat / count, lng: sumLng / count }
}

export default function AddZone() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id && !window.location.pathname.includes('/view/')
  
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteServiceRef = useRef(null)
  const placesServiceRef = useRef(null)
  const geocoderRef = useRef(null)
  const suggestionsDebounceRef = useRef(null)
  const existingZonesPolygonsRef = useRef([])

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [existingZones, setExistingZones] = useState([])

  // Form State
  const [formData, setFormData] = useState({
    country: "India",
    zoneName: "",
    unit: "kilometer",
  })

  // Selected Location State
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (suggestionsDebounceRef.current) {
        clearTimeout(suggestionsDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    fetchExistingZones()
    loadGoogleMaps()
  }, [id])

  // Initialize Services when map loads
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && window.google?.maps?.places) {
      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      }
      if (!placesServiceRef.current) {
        placesServiceRef.current = new window.google.maps.places.PlacesService(mapInstanceRef.current)
      }
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder()
      }
    }
  }, [mapLoading])

  const fetchExistingZones = async () => {
    try {
      const response = await adminAPI.getZones({ limit: 1000 })
      if (response.data?.success && response.data.data?.zones) {
        const zones = isEditMode && id 
          ? response.data.data.zones.filter(zone => zone._id !== id)
          : response.data.data.zones
        setExistingZones(zones)
      }
    } catch (error) {
      console.error("Error fetching existing zones:", error)
      setExistingZones([])
    }
  }

  const loadGoogleMaps = async () => {
    try {
      const apiKey = await getGoogleMapsApiKey()
      setGoogleMapsApiKey(apiKey || "loaded")
      
      let retries = 0
      const maxRetries = 50
      while (!window.google && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      if (window.google && window.google.maps) {
        initializeMap(window.google)
        return
      }

      if (apiKey) {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: LIBRARIES
        })
        const google = await loader.load()
        initializeMap(google)
      } else {
        setMapLoading(false)
      }
    } catch (error) {
      console.error("Error loading Google Maps:", error)
      setMapLoading(false)
    }
  }

  const initializeMap = (google) => {
    if (!mapRef.current) return

    const initialLocation = { lat: 20.5937, lng: 78.9629 } // India Center

    const map = new google.maps.Map(mapRef.current, {
      center: initialLocation,
      zoom: 5,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scrollwheel: true,
      gestureHandling: 'greedy',
    })

    mapInstanceRef.current = map

    // Click on map to select location (Method 3)
    map.addListener('click', (event) => {
      const lat = event.latLng.lat()
      const lng = event.latLng.lng()
      handleLocationSelect(lat, lng, null, true)
    })

    setMapLoading(false)

    // Load active zone if editing
    if (isEditMode && id) {
      fetchZone(google, map)
    }
  }

  const fetchZone = async (google, map) => {
    try {
      setLoading(true)
      const response = await adminAPI.getZoneById(id)
      if (response.data?.success && response.data.data?.zone) {
        const zoneData = response.data.data.zone
        setFormData({
          country: zoneData.country || "India",
          zoneName: zoneData.name || zoneData.zoneName || "",
          unit: zoneData.unit || "kilometer",
        })

        let lat = zoneData.latitude
        let lng = zoneData.longitude
        let address = zoneData.address || zoneData.serviceLocation || ""

        // Fallback: If no explicit point coordinates, use polygon center
        if (lat == null || lng == null) {
          const center = getPolygonCenter(zoneData.coordinates)
          lat = center.lat
          lng = center.lng
        }

        if (lat != null && lng != null) {
          const loc = { lat, lng, address }
          setSelectedLocation(loc)
          setLocationSearch(address)
          
          // Place marker and focus
          placeMarkerOnMap(google, map, { lat, lng }, address)
        }
      }
    } catch (error) {
      console.error("Error fetching zone:", error)
      toast.error("Failed to load zone")
      navigate("/admin/food/zone-setup")
    } finally {
      setLoading(false)
    }
  }

  // Draw existing zones as background references
  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) return

    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    existingZonesPolygonsRef.current = []

    existingZones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      const path = zone.coordinates.map(coord => {
        const lat = coord.latitude ?? coord.lat
        const lng = coord.longitude ?? coord.lng
        if (lat == null || lng == null) return null
        return new google.maps.LatLng(lat, lng)
      }).filter(Boolean)

      if (path.length < 3) return

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.4,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        editable: false,
        draggable: false,
        clickable: true,
        zIndex: 0
      })

      polygon.setMap(map)
      existingZonesPolygonsRef.current.push(polygon)

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 6px; font-size: 12px; font-weight: 500;">${zone.name}</div>`
      })

      polygon.addListener('click', () => {
        infoWindow.setPosition(polygon.getPath().getAt(0))
        infoWindow.open(map)
      })
    })
  }

  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current)
    }
  }, [existingZones, mapLoading])

  // Place/move a single marker on map
  const placeMarkerOnMap = (google, map, position, title) => {
    if (markerRef.current) {
      markerRef.current.setPosition(position)
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        animation: google.maps.Animation.DROP,
        title: title || "Selected location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3
        }
      })
    }

    map.panTo(position)
    map.setZoom(16)
  }

  // Unified Location selection and Geocoding handler
  const handleLocationSelect = (lat, lng, addressString = null, performReverseGeocoding = false) => {
    const google = window.google
    const map = mapInstanceRef.current
    if (!google || !map) return

    const pos = { lat, lng }

    if (performReverseGeocoding && geocoderRef.current) {
      geocoderRef.current.geocode({ location: pos }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const resolvedAddress = results[0].formatted_address
          setSelectedLocation({
            lat,
            lng,
            address: resolvedAddress
          })
          setLocationSearch(resolvedAddress)
          placeMarkerOnMap(google, map, pos, resolvedAddress)
        } else {
          setSelectedLocation({ lat, lng, address: `Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}` })
          placeMarkerOnMap(google, map, pos)
        }
      })
    } else {
      setSelectedLocation({ lat, lng, address: addressString || "" })
      if (addressString) setLocationSearch(addressString)
      placeMarkerOnMap(google, map, pos, addressString)
    }
  }

  // Method 1 - Google Autocomplete Predictions
  const handleLocationSearchChange = (value) => {
    setLocationSearch(value)
    setShowSuggestions(true)

    if (suggestionsDebounceRef.current) {
      clearTimeout(suggestionsDebounceRef.current)
    }

    const query = String(value || "").trim()
    if (!query || !autocompleteServiceRef.current || !window.google?.maps?.places?.PlacesServiceStatus) {
      setSearchSuggestions([])
      return
    }

    suggestionsDebounceRef.current = setTimeout(() => {
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "in" },
          types: ["geocode", "establishment"]
        },
        (predictions = [], status) => {
          const ok = status === window.google?.maps?.places?.PlacesServiceStatus?.OK
          setSearchSuggestions(ok ? predictions.slice(0, 6) : [])
        }
      )
    }, 200)
  }

  // Method 1 Selection
  const handleSuggestionSelect = (suggestion) => {
    if (!suggestion?.place_id || !placesServiceRef.current) return

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ["geometry", "formatted_address", "name"],
      },
      (place, status) => {
        if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const address = place.formatted_address || place.name || ""
          handleLocationSelect(lat, lng, address, false)
          setSearchSuggestions([])
          setShowSuggestions(false)
        }
      }
    )
  }

  // Method 2 - Browser Current Location Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.")
      return
    }

    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        handleLocationSelect(lat, lng, null, true)
        setGpsLoading(false)
        toast.success("Current location detected!")
      },
      (error) => {
        setGpsLoading(false)
        console.error("Geolocation error:", error)
        toast.error("Failed to detect your current location. Please allow location permissions.")
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.zoneName.trim()) {
      toast.error("Please enter a zone name")
      return
    }

    if (!selectedLocation) {
      toast.error("Please select a location on the map, use current location, or search an address.")
      return
    }

    try {
      setLoading(true)
      
      const lat = selectedLocation.lat
      const lng = selectedLocation.lng
      
      // Auto-generate bounding box polygon points around center coordinates for schema compatibility
      const legacyCoordinates = generateBoundingBox(lat, lng, 3)

      const zoneData = {
        name: formData.zoneName.trim(),
        zoneName: formData.zoneName.trim(),
        country: formData.country,
        unit: formData.unit || "kilometer",
        coordinates: legacyCoordinates,
        latitude: lat,
        longitude: lng,
        address: selectedLocation.address,
        serviceLocation: selectedLocation.address,
        isActive: true
      }

      if (isEditMode && id) {
        await adminAPI.updateZone(id, zoneData)
        toast.success("Zone updated successfully!")
      } else {
        await adminAPI.createZone(zoneData)
        toast.success("Zone created successfully!")
      }
      navigate("/admin/food/zone-setup")
    } catch (error) {
      console.error("Error saving zone:", error)
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to save zone."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/admin/food/zone-setup")}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors bg-white border border-slate-200"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                {isEditMode ? "Edit Delivery Zone" : "Add New Delivery Zone"}
              </h1>
              <p className="text-sm text-slate-500">
                Select a central location for the delivery zone using coordinates or maps searching.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Setup Fields */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Zone Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Country</label>
                <select
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="India">India</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Create Zone Name *</label>
                <input
                  type="text"
                  value={formData.zoneName}
                  onChange={(e) => handleInputChange("zoneName", e.target.value)}
                  placeholder="e.g. South Delhi, Indore Central"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Select Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleInputChange("unit", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="kilometer">Kilometers (km)</option>
                  <option value="miles">Miles (mi)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Selection Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-[32%_68%] gap-6">
            <div className="space-y-4">
              {/* Searching and locate buttons */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Choose Location</h3>
                  <p className="text-xs text-slate-500 mt-1">Search, use your GPS location, or click directly on the map viewer.</p>
                </div>

                {/* Autocomplete Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={autocompleteInputRef}
                    type="text"
                    placeholder="Search address or area..."
                    value={locationSearch}
                    onChange={(e) => handleLocationSearchChange(e.target.value)}
                    onFocus={() => {
                      if (searchSuggestions.length > 0) setShowSuggestions(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 150)
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.place_id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSuggestionSelect(suggestion)
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-start gap-2 text-xs"
                        >
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div className="truncate">
                            <span className="block font-semibold text-slate-800 truncate">
                              {suggestion.structured_formatting?.main_text || suggestion.description}
                            </span>
                            <span className="block text-[10px] text-slate-500 truncate">
                              {suggestion.structured_formatting?.secondary_text || suggestion.description}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geolocation trigger */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={gpsLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm shadow-emerald-500/5 disabled:opacity-50"
                >
                  <Compass className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>Use Current Location</span>
                </button>
              </div>

              {/* Selected Location Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Selected Address details</h3>
                
                {selectedLocation ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-xl">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Address</p>
                      <p className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">{selectedLocation.address || "Unnamed Location"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latitude</p>
                        <p className="text-xs font-black text-slate-700 mt-0.5">{selectedLocation.lat.toFixed(6)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Longitude</p>
                        <p className="text-xs font-black text-slate-700 mt-0.5">{selectedLocation.lng.toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">No location selected yet.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[180px]">Select a point on map or search an address above.</p>
                  </div>
                )}
              </div>

              {/* Form Action Controls */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !selectedLocation || !formData.zoneName.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin w-4 h-4" />
                      <span>Saving location...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Location</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => navigate("/admin/food/zone-setup")}
                  className="px-5 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Google Map Viewer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 min-h-[500px] flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Map View</h3>
                <p className="text-xs text-slate-500 mt-0.5">Click directly on the map area to instantly pin and capture coordinates.</p>
              </div>

              <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 min-h-[420px]">
                <div ref={mapRef} className="absolute inset-0 h-full w-full" />

                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-xl z-10">
                    <div className="text-center">
                      <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-3" />
                      <p className="text-xs font-semibold text-slate-600">Loading Google Maps...</p>
                    </div>
                  </div>
                )}

                {!googleMapsApiKey && !mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-xl z-10 p-6 text-center">
                    <div>
                      <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800">Google Maps API key not found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-[240px]">Configure your API key in settings/env file to initialize the map editor.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
