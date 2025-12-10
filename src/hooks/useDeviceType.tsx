import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export type DeviceType = "mobile" | "tablet" | "desktop";

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = React.useState<DeviceType>("desktop");

  React.useEffect(() => {
    const updateDeviceType = () => {
      const width = window.innerWidth;
      if (width < MOBILE_BREAKPOINT) {
        setDeviceType("mobile");
      } else if (width < TABLET_BREAKPOINT) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };

    updateDeviceType();
    
    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    
    mqlMobile.addEventListener("change", updateDeviceType);
    mqlTablet.addEventListener("change", updateDeviceType);
    
    return () => {
      mqlMobile.removeEventListener("change", updateDeviceType);
      mqlTablet.removeEventListener("change", updateDeviceType);
    };
  }, []);

  return deviceType;
}

export function useIsMobileOrTablet(): boolean {
  const deviceType = useDeviceType();
  return deviceType === "mobile" || deviceType === "tablet";
}
