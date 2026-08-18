import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, OrbitControls, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { Book as BookType } from '../books';

interface BookshelfSceneProps {
    books?: BookType[];
    selectedBook: BookType | null;
    onSelectBook: (book: BookType) => void;
    onPreviewBook: (book: BookType | null) => void;
    onReadBook?: (book: BookType) => void;
    isTransitioning: boolean;
    setIsTransitioning: (val: boolean) => void;
    isFlipped: boolean;
    setIsFlipped: (val: boolean) => void;
    isSearchActive?: boolean;
    warmFilterIntensity: number;
}

// Proxies remote URLs through wsrv.nl to bypass browser CORS headers on WebGL textures
const getCorsImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};

// Renders a textured plane on the front cover face of a book
const BookCover: React.FC<{
    url: string;
    width: number;
    height: number;
    positionZ: number;
    positionX: number;
}> = ({ url, width, height, positionZ, positionX }) => {
    const texture = useTexture(url);
    return (
        <mesh position={[positionX, 0, positionZ]} renderOrder={1}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={texture}
                toneMapped={false}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
            />
        </mesh>
    );
};


// Hardcover Custom 3D Book Geometry Component
interface CustomBookProps {
    width: number;
    height: number;
    depth: number;
    coverThickness: number;
    overhang: number;
    coverColor: string;
}

const CustomBook: React.FC<CustomBookProps> = ({
    width,
    height,
    depth,
    coverThickness,
    overhang,
    coverColor
}) => {
    const { coverGeo } = React.useMemo(() => {
        const coverShape = new THREE.Shape();
        const spineRadius = (depth / 2) + coverThickness;
        const spineCenterX = -(width / 2);
        const coverLength = width + overhang;
        const halfCoverDepth = depth / 2;

        // Outer Path
        coverShape.moveTo(spineCenterX + coverLength, halfCoverDepth + coverThickness);
        coverShape.lineTo(spineCenterX, halfCoverDepth + coverThickness);

        // Curved Outer Spine
        coverShape.absarc(
            spineCenterX,
            0,
            spineRadius,
            Math.PI / 2,
            -Math.PI / 2,
            false
        );

        coverShape.lineTo(spineCenterX + coverLength, -halfCoverDepth - coverThickness);
        coverShape.lineTo(spineCenterX + coverLength, -halfCoverDepth);
        coverShape.lineTo(spineCenterX, -halfCoverDepth);

        // Curved Inner Spine
        coverShape.absarc(
            spineCenterX,
            0,
            depth / 2,
            -Math.PI / 2,
            Math.PI / 2,
            true
        );

        coverShape.lineTo(spineCenterX + coverLength, halfCoverDepth);
        coverShape.closePath();

        // Extrude Settings
        const extrudeSettings = {
            steps: 1,
            depth: height + (overhang * 2),
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.008,
            bevelSegments: 3,
            curveSegments: 24
        };

        const geo = new THREE.ExtrudeGeometry(coverShape, extrudeSettings);
        geo.center();
        return { coverGeo: geo };
    }, [width, height, depth, coverThickness, overhang]);

    return (
        <group>
            {/* 1. Inside Pages Block */}
            <mesh castShadow receiveShadow position={[overhang / 2, 0, 0]}>
                <boxGeometry args={[width, height, depth]} />
                <meshStandardMaterial color="#f2eee2" roughness={0.85} />
            </mesh>

            {/* 2. Hardcover Casing */}
            <mesh geometry={coverGeo} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={coverColor} roughness={0.4} metalness={0.15} />
            </mesh>
        </group>
    );
};

interface BookMeshProps {
    book: BookType;
    position: [number, number, number];
    rotation: [number, number, number];
    dimensions: [number, number, number]; // [thickness, height, width_depth]
    onSelect: () => void;
    onPreview: () => void;
    isTransitioning: boolean;
    setIsTransitioning: (val: boolean) => void;
    isActive: boolean;
    isFlipped: boolean;
    onReadBook?: () => void;
}

// Select text color for spine based on cover color contrast
const getSpineTextColor = (coverColor: string) => {
    const c = coverColor.toLowerCase();
    if (c === '#ffffff' || c === '#f2eee2' || c === '#e8e4d9' || c === '#ffdca3' || c === '#ffebb3') {
        return '#1a120b';
    }
    return '#f5d061';
};

const BookMesh: React.FC<BookMeshProps> = ({
    book,
    position,
    rotation,
    dimensions,
    onSelect,
    onPreview,
    isTransitioning,
    setIsTransitioning,
    isActive,
    isFlipped,
    onReadBook
}) => {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const coverGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const [btnHovered, setBtnHovered] = useState(false);
    const [isThisAnimating, setIsThisAnimating] = useState(false);
    const [textOpacity, setTextOpacity] = useState(1);
    const wasActiveRef = useRef(false);

    // Animate cover swing open/close
    useEffect(() => {
        if (!coverGroupRef.current) return;
        if (isActive && isFlipped) {
            gsap.to(coverGroupRef.current.rotation, {
                y: -Math.PI * 0.85,
                duration: 0.8,
                ease: 'power2.out'
            });
        } else {
            gsap.to(coverGroupRef.current.rotation, {
                y: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
        }
    }, [isActive, isFlipped]);

    const isFlat = Math.abs(rotation[0]) > 1.0;
    const coverThickness = 0.012;
    const overhang = 0.016;

    const verticalCasingHeight = isFlat
        ? (dimensions[0] + coverThickness * 2)
        : (dimensions[1] + overhang * 2);

    const outerRotation: [number, number, number] = isFlat
        ? [0, rotation[1] + Math.PI / 2, 0]
        : [rotation[0], rotation[1] + Math.PI / 2, rotation[2]];

    // Smooth return animation when deselected
    useEffect(() => {
        if (wasActiveRef.current && !isActive) {
            if (groupRef.current) {
                setIsThisAnimating(true);
                setTextOpacity(0);
                const tl = gsap.timeline({
                    onComplete: () => {
                        setIsThisAnimating(false);
                        setIsTransitioning(false);
                        const opacityObj = { val: 0 };
                        gsap.to(opacityObj, {
                            val: 1,
                            duration: 0.35,
                            onUpdate: () => setTextOpacity(opacityObj.val)
                        });
                    }
                });

                // Glide back to original shelf coordinates
                tl.to(groupRef.current.position, {
                    x: position[0],
                    y: position[1] + (hovered ? 0.05 : 0),
                    z: position[2] + (hovered ? 0.25 : 0),
                    duration: 0.8,
                    ease: 'power3.inOut'
                });

                tl.to(groupRef.current.rotation, {
                    x: outerRotation[0],
                    y: outerRotation[1],
                    z: outerRotation[2],
                    duration: 0.8,
                    ease: 'power3.inOut'
                }, '<');

                tl.to(groupRef.current.scale, {
                    x: 1.0,
                    y: 1.0,
                    z: 1.0,
                    duration: 0.8,
                    ease: 'power3.inOut'
                }, '<');
            }
        }
        wasActiveRef.current = isActive;
    }, [isActive, position, outerRotation, hovered, setIsTransitioning]);

    // Hover animations using GSAP
    useEffect(() => {
        if (isThisAnimating || isTransitioning || isActive || !groupRef.current) return;

        gsap.to(groupRef.current.position, {
            z: hovered ? 0.25 : position[2],
            duration: 0.35,
            ease: 'power2.out'
        });

        gsap.to(groupRef.current.rotation, {
            y: hovered && !isFlat ? outerRotation[1] - 0.12 : outerRotation[1],
            duration: 0.35,
            ease: 'power2.out'
        });

        gsap.to(groupRef.current.scale, {
            x: hovered ? 1.06 : 1.0,
            y: hovered ? 1.06 : 1.0,
            z: hovered ? 1.06 : 1.0,
            duration: 0.35,
            ease: 'power2.out'
        });
    }, [hovered, isThisAnimating, isTransitioning, isActive, position, outerRotation, isFlat]);

    // Dynamic hover floating effect when idle
    useFrame((state) => {
        if (!groupRef.current || isThisAnimating || isActive || isTransitioning) return;

        const scaleOffset = (groupRef.current.scale.y - 1.0) * (verticalCasingHeight / 2);
        if (hovered && !isTransitioning) {
            const floatOffset = Math.sin(state.clock.getElapsedTime() * 4) * 0.012 + 0.012;
            groupRef.current.position.y = THREE.MathUtils.lerp(
                groupRef.current.position.y,
                position[1] + scaleOffset + floatOffset,
                0.15
            );
        } else {
            groupRef.current.position.y = THREE.MathUtils.lerp(
                groupRef.current.position.y,
                position[1] + scaleOffset,
                0.15
            );
        }
    });

    const handleBookClick = () => {
        if (isTransitioning) return;

        if (isActive) {
            onSelect();
            return;
        }

        onPreview();

        const opacityObj = { val: 1 };
        gsap.to(opacityObj, {
            val: 0,
            duration: 0.18,
            onUpdate: () => setTextOpacity(opacityObj.val)
        });

        setIsThisAnimating(true);
        setIsTransitioning(true);

        if (groupRef.current) {
            const tl = gsap.timeline({
                onComplete: () => {
                    setIsThisAnimating(false);
                    setIsTransitioning(false);
                }
            });

            const aspect = window.innerWidth / window.innerHeight;
            const targetX = camera.position.x;
            const targetY = camera.position.y + 0.2;
            const targetZ = camera.position.z - (aspect < 1.0 ? 3.0 : 2.5);
            const targetScale = aspect < 1.0 ? 0.75 : 0.95;

            tl.to(groupRef.current.position, {
                x: targetX,
                y: targetY,
                z: targetZ,
                duration: 1.0,
                ease: 'power3.inOut'
            });

            tl.to(groupRef.current.rotation, {
                x: isFlat ? -Math.PI / 2 : 0,
                y: 0,
                z: 0,
                duration: 1.0,
                ease: 'power3.inOut'
            }, 0);

            tl.to(groupRef.current.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale,
                duration: 1.0,
                ease: 'power3.inOut'
            }, 0);
        }
    };

    const innerRotation: [number, number, number] = isFlat
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];

    return (
        <group
            ref={groupRef}
            position={position}
            rotation={outerRotation}
            onClick={(e) => {
                e.stopPropagation();
                handleBookClick();
            }}
            onPointerOver={(e) => {
                if (isTransitioning) return;
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
                if (isTransitioning) return;
                e.stopPropagation();
                setHovered(false);
                document.body.style.cursor = 'default';
            }}
        >
            <group rotation={innerRotation}>
                {!(isActive && isFlipped) ? (
                    <>
                        <CustomBook
                            width={dimensions[2]}
                            height={dimensions[1]}
                            depth={dimensions[0]}
                            coverThickness={coverThickness}
                            overhang={overhang}
                            coverColor={book.color}
                        />

                        {/* Render cover image on the front face of the book */}
                        {book.coverUrl && (
                            <BookCover
                                url={getCorsImageUrl(book.coverUrl)}
                                width={dimensions[2] + overhang}
                                height={dimensions[1] + overhang * 2}
                                positionX={dimensions[0] / 4 + coverThickness / 2}
                                positionZ={dimensions[0] / 2 + coverThickness + 0.008}
                            />
                        )}
                    </>
                ) : (
                    <>
                        {/* 1. Inside Pages Block */}
                        <mesh position={[overhang / 2, 0, 0]} castShadow receiveShadow>
                            <boxGeometry args={[dimensions[2], dimensions[1], dimensions[0]]} />
                            <meshStandardMaterial color="#f2eee2" roughness={0.85} />

                            {/* Render summary directly on the page in 3D */}
                            <group position={[0, 0, dimensions[0] / 2 + 0.005]}>
                                {/* Title */}
                                <Text
                                    position={[0, dimensions[1] / 2 - 0.08, 0]}
                                    fontSize={0.034}
                                    color="#1a1008"
                                    fontWeight="bold"
                                    maxWidth={dimensions[2] - 0.08}
                                    textAlign="center"
                                    anchorX="center"
                                    anchorY="top"
                                >
                                    {book.title}
                                </Text>

                                {/* Author */}
                                <Text
                                    position={[0, dimensions[1] / 2 - 0.22, 0]}
                                    fontSize={0.024}
                                    color="#8c7d70"
                                    maxWidth={dimensions[2] - 0.08}
                                    textAlign="center"
                                    anchorX="center"
                                    anchorY="top"
                                >
                                    By {book.author}
                                </Text>

                                {/* Summary Text block */}
                                <Text
                                    position={[0, 0.06, 0]}
                                    fontSize={0.02}
                                    color="#3d3126"
                                    maxWidth={dimensions[2] - 0.06}
                                    textAlign="justify"
                                    anchorX="center"
                                    anchorY="middle"
                                    lineHeight={1.3}
                                >
                                    {book.summary
                                        ? (book.summary.length > 250 ? `${book.summary.slice(0, 250)}...` : book.summary)
                                        : "No summary available for this book."
                                    }
                                </Text>

                                {/* 3D Button */}
                                <group
                                    position={[0, -dimensions[1] / 2 + 0.08, 0]}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onReadBook) {
                                            onReadBook();
                                        } else {
                                            onSelect();
                                        }
                                    }}
                                    onPointerOver={(e) => {
                                        e.stopPropagation();
                                        setBtnHovered(true);
                                        document.body.style.cursor = 'pointer';
                                    }}
                                    onPointerOut={(e) => {
                                        e.stopPropagation();
                                        setBtnHovered(false);
                                        document.body.style.cursor = 'default';
                                    }}
                                >
                                    <mesh castShadow receiveShadow>
                                        <boxGeometry args={[dimensions[2] - 0.12, 0.08, 0.005]} />
                                        <meshStandardMaterial
                                            color={btnHovered ? '#b45309' : '#d97706'}
                                            roughness={0.6}
                                            metalness={0.1}
                                        />
                                    </mesh>
                                    <Text
                                        position={[0, 0, 0.004]}
                                        fontSize={0.026}
                                        color="#ffffff"
                                        fontWeight="bold"
                                        anchorX="center"
                                        anchorY="middle"
                                    >
                                        Read Book
                                    </Text>
                                </group>
                            </group>
                        </mesh>

                        {/* 2. Back Cover */}
                        <mesh position={[overhang / 2, 0, -dimensions[0] / 2 - coverThickness / 2]} castShadow receiveShadow>
                            <boxGeometry args={[dimensions[2] + overhang, dimensions[1] + overhang * 2, coverThickness]} />
                            <meshStandardMaterial color={book.color} roughness={0.4} metalness={0.15} />
                        </mesh>

                        {/* 3. Spine */}
                        <mesh position={[-dimensions[2] / 2 - coverThickness / 2, 0, 0]} castShadow receiveShadow>
                            <boxGeometry args={[coverThickness, dimensions[1] + overhang * 2, dimensions[0] + coverThickness * 2]} />
                            <meshStandardMaterial color={book.color} roughness={0.4} metalness={0.15} />
                        </mesh>

                        {/* 4. Front Cover Group (Pivot at spine left edge) */}
                        <group ref={coverGroupRef} position={[-dimensions[2] / 2, 0, dimensions[0] / 2 + coverThickness]}>
                            {/* Front Cover Plate */}
                            <mesh position={[(dimensions[2] + overhang) / 2, 0, -coverThickness / 2]} castShadow receiveShadow>
                                <boxGeometry args={[dimensions[2] + overhang, dimensions[1] + overhang * 2, coverThickness]} />
                                <meshStandardMaterial color={book.color} roughness={0.4} metalness={0.15} />
                            </mesh>
                            {/* Render cover image on the front face of the cover */}
                            {book.coverUrl && (
                                <BookCover
                                    url={getCorsImageUrl(book.coverUrl)}
                                    width={dimensions[2] + overhang}
                                    height={dimensions[1] + overhang * 2}
                                    positionX={(dimensions[2] + overhang) / 2}
                                    positionZ={0.001}
                                />
                            )}
                        </group>
                    </>
                )}

                {textOpacity > 0 && (
                    <Text
                        position={[-(dimensions[2] / 2) - (dimensions[0] / 2) - coverThickness - (overhang / 2) - 0.004, 0, 0]}
                        rotation={[0, -Math.PI / 2, Math.PI / 2]}
                        fontSize={Math.min(0.05, dimensions[0] * 0.4)}
                        color={getSpineTextColor(book.color)}
                        anchorX="center"
                        anchorY="middle"
                        depthOffset={-2}
                        fillOpacity={textOpacity}
                    >
                        {book.title.length > 30 ? `${book.title.slice(0, 30)}…` : book.title}
                    </Text>
                )}
            </group>
        </group>
    );
};



// Sub-component to clamp camera panning coordinates and lock Y/Z dimensions
interface CameraControllerProps {
    controlsRef: React.RefObject<any>;
}

const CameraController: React.FC<CameraControllerProps> = ({ controlsRef }) => {
    useFrame(() => {
        if (controlsRef.current) {
            const shelfHalfWidth = 3.25;
            // Allow panning enough to center the edge books, especially on mobile/portrait screens
            const maxX = shelfHalfWidth - 0.5;
            const maxY = 0.20;

            controlsRef.current.target.x = THREE.MathUtils.clamp(controlsRef.current.target.x, -maxX, maxX);
            controlsRef.current.target.y = THREE.MathUtils.clamp(controlsRef.current.target.y, -maxY, maxY);
            controlsRef.current.target.z = 0;

            const camera = controlsRef.current.object;
            if (camera) {
                camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
                camera.position.y = THREE.MathUtils.clamp(camera.position.y, -maxY, maxY);
            }
        }
    });
    return null;
};

// Auto-pan camera to left side of top shelf on mobile when search is active
interface SearchCameraFocusProps {
    controlsRef: React.RefObject<any>;
    isSearchActive: boolean;
    aspect: number;
}

const SearchCameraFocus: React.FC<SearchCameraFocusProps> = ({ controlsRef, isSearchActive, aspect }) => {
    const { camera } = useThree();
    const prevSearchActive = useRef(false);

    useEffect(() => {
        const isMobile = aspect < 1.0;

        if (isSearchActive && !prevSearchActive.current && isMobile) {
            // Pan camera to show left side of top shelf where first books appear
            if (controlsRef.current) {
                gsap.to(controlsRef.current.target, {
                    x: -2.5,
                    y: 0.15,
                    duration: 1.0,
                    ease: 'power2.inOut'
                });
            }
            gsap.to(camera.position, {
                x: -2.5,
                y: 0.15,
                duration: 1.0,
                ease: 'power2.inOut'
            });
        } else if (!isSearchActive && prevSearchActive.current) {
            // Reset camera to center when search is cleared
            if (controlsRef.current) {
                gsap.to(controlsRef.current.target, {
                    x: 0,
                    y: 0,
                    duration: 1.0,
                    ease: 'power2.inOut'
                });
            }
            gsap.to(camera.position, {
                x: 0,
                y: 0.05,
                duration: 1.0,
                ease: 'power2.inOut'
            });
        }
        prevSearchActive.current = isSearchActive;
    }, [isSearchActive, aspect, camera, controlsRef]);

    return null;
};

export const BookshelfScene: React.FC<BookshelfSceneProps> = ({
    books = [],
    selectedBook,
    onSelectBook,
    onPreviewBook,
    onReadBook,
    isTransitioning,
    setIsTransitioning,
    isFlipped,
    setIsFlipped: _setIsFlipped,
    isSearchActive = false,
    warmFilterIntensity
}) => {
    const controlsRef = useRef<any>(null);
    const [aspect, setAspect] = useState(window.innerWidth / window.innerHeight);

    useEffect(() => {
        const handleResize = () => setAspect(window.innerWidth / window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const cameraZ = aspect < 1.0 ? Math.min(12.5, 8.8 / aspect) : 5.4;
    const fov = 45;

    // Preset Layout for books
    const topShelfBooks = [
        { id: 'personal-letter', pos: [-2.7, 1.23, 0], rot: [0, 0, -0.2], size: [0.18, 0.9, 0.65] },
        { id: 'alice-in-wonderland', pos: [-2.4, 1.26, 0], rot: [0, 0, 0], size: [0.22, 0.96, 0.65] },
        { id: 'pride-and-prejudice', pos: [-2.1, 1.22, 0], rot: [0, 0, 0], size: [0.2, 0.88, 0.65] },
        { id: 'sherlock-holmes', pos: [-1.8, 1.28, 0], rot: [0, 0, 0], size: [0.24, 1.0, 0.65] },
        { id: 'the-great-gatsby', pos: [-1.5, 1.24, 0], rot: [0, 0, 0], size: [0.18, 0.92, 0.65] },
        { id: 'little-prince', pos: [-1.2, 1.21, 0], rot: [0, 0, 0.18], size: [0.2, 0.86, 0.65] },
        { id: 'pride-and-prejudice', pos: [-0.8, 1.22, 0], rot: [0, 0, 0], size: [0.22, 0.88, 0.65] },
        { id: 'alice-in-wonderland', pos: [-0.5, 1.26, 0], rot: [0, 0, 0], size: [0.24, 0.96, 0.65] },
        { id: 'sherlock-holmes', pos: [-0.2, 1.28, 0], rot: [0, 0, 0], size: [0.18, 1.0, 0.65] },
        { id: 'the-great-gatsby', pos: [0.2, 1.24, 0], rot: [0, 0, -0.15], size: [0.22, 0.92, 0.65] },
        { id: 'personal-letter', pos: [0.55, 1.23, 0], rot: [0, 0, 0], size: [0.2, 0.9, 0.65] },
        { id: 'little-prince', pos: [0.9, 1.21, 0], rot: [0, 0, 0], size: [0.24, 0.86, 0.65] },
        { id: 'alice-in-wonderland', pos: [1.25, 1.26, 0], rot: [0, 0, 0], size: [0.2, 0.96, 0.65] },
        { id: 'sherlock-holmes', pos: [1.6, 1.28, 0], rot: [0, 0, 0], size: [0.22, 1.0, 0.65] },
        { id: 'pride-and-prejudice', pos: [2.0, 1.22, 0], rot: [0, 0, 0.2], size: [0.2, 0.88, 0.65] },
        { id: 'the-great-gatsby', pos: [2.4, 1.24, 0], rot: [0, 0, 0], size: [0.18, 0.92, 0.65] },
        { id: 'little-prince', pos: [2.75, 1.21, 0], rot: [0, 0, 0], size: [0.22, 0.86, 0.65] }
    ];

    const bottomShelfBooks = [
        { id: 'sherlock-holmes', pos: [-2.7, 0, 0], rot: [0, 0, -0.18], size: [0.22, 0.92, 0.65] },
        { id: 'the-great-gatsby', pos: [-2.35, 0, 0], rot: [0, 0, 0], size: [0.2, 0.88, 0.65] },
        { id: 'alice-in-wonderland', pos: [-2.05, 0, 0], rot: [0, 0, 0], size: [0.24, 0.96, 0.65] },
        { id: 'pride-and-prejudice', pos: [-1.75, 0, 0], rot: [0, 0, 0], size: [0.18, 0.88, 0.65] },
        { id: 'personal-letter', pos: [-1.0, -0.948, 0], rot: [Math.PI / 2, 0, 0], size: [0.16, 0.9, 0.65] },
        { id: 'pride-and-prejudice', pos: [-1.0, -0.764, 0], rot: [Math.PI / 2, 0, 0], size: [0.16, 0.86, 0.65] },
        { id: 'little-prince', pos: [-1.0, -0.59, 0], rot: [Math.PI / 2, 0, 0], size: [0.14, 0.8, 0.65] },
        { id: 'sherlock-holmes', pos: [-0.2, 0, 0], rot: [0, 0, 0], size: [0.22, 0.9, 0.65] },
        { id: 'the-great-gatsby', pos: [0.1, 0, 0], rot: [0, 0, 0], size: [0.2, 0.88, 0.65] },
        { id: 'alice-in-wonderland', pos: [0.4, 0, 0], rot: [0, 0, 0], size: [0.24, 0.96, 0.65] },
        { id: 'pride-and-prejudice', pos: [0.75, 0, 0], rot: [0, 0, 0.18], size: [0.18, 0.86, 0.65] },
        { id: 'personal-letter', pos: [1.2, 0, 0], rot: [0, 0, 0], size: [0.22, 0.9, 0.65] },
        { id: 'little-prince', pos: [1.5, 0, 0], rot: [0, 0, 0], size: [0.2, 0.86, 0.65] },
        { id: 'sherlock-holmes', pos: [1.8, 0, 0], rot: [0, 0, 0], size: [0.24, 0.9, 0.65] },
        { id: 'the-great-gatsby', pos: [2.1, 0, 0], rot: [0, 0, 0], size: [0.18, 0.88, 0.65] },
        { id: 'pride-and-prejudice', pos: [2.45, 0, 0], rot: [0, 0, -0.15], size: [0.2, 0.86, 0.65] },
        { id: 'alice-in-wonderland', pos: [2.8, 0, 0], rot: [0, 0, 0], size: [0.22, 0.96, 0.65] }
    ];

    const ambientIntensity = 0.85;
    const directionalIntensity = 1.1;

    const lightColor = new THREE.Color(
        1.0,
        1.0 - (warmFilterIntensity * 0.12),
        1.0 - (warmFilterIntensity * 0.3)
    );

    return (
        <div className="w-full h-full relative">
            <Canvas
                key={aspect < 1.0 ? 'portrait' : 'landscape'}
                shadows
                camera={{ position: [0, 0.05, cameraZ], fov: fov }}
                className={`w-full h-full bg-transparent ${isTransitioning ? 'pointer-events-none' : ''}`}
                eventSource={document.getElementById('root') || undefined}
                onPointerMissed={() => {
                    if (selectedBook && !isTransitioning) {
                        onPreviewBook(null);
                        setIsTransitioning(true);
                    }
                }}
            >
                {/* Lights */}
                <ambientLight intensity={ambientIntensity} color={lightColor} />
                <directionalLight
                    position={[4, 6, 4]}
                    intensity={directionalIntensity}
                    color={lightColor}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-bias={-0.0005}
                    shadow-camera-left={-4}
                    shadow-camera-right={4}
                    shadow-camera-top={4}
                    shadow-camera-bottom={-4}
                    shadow-camera-near={0.5}
                    shadow-camera-far={12}
                />

                <spotLight
                    position={[0, 3.5, 2.5]}
                    angle={0.7}
                    penumbra={1}
                    intensity={0.8}
                    color="#ffdca3"
                    castShadow
                    shadow-mapSize-width={1024}
                    shadow-mapSize-height={1024}
                />

                <Center>
                    {/* Back Wall */}
                    <mesh position={[0, 0, -0.8]} receiveShadow>
                        <planeGeometry args={[16, 12]} />
                        <meshStandardMaterial
                            color="#fcfbfa"
                            roughness={0.9}
                        />
                    </mesh>

                    {/* Shelves & Books Container */}
                    <group position={[0, -0.2, 0]}>
                        {/* TOP SHELF WOOD */}
                        <mesh position={[0, 0.72, -0.05]} castShadow receiveShadow>
                            <boxGeometry args={[6.5, 0.12, 0.9]} />
                            <meshStandardMaterial
                                color="#8a5c38"
                                roughness={0.7}
                                metalness={0.15}
                            />
                        </mesh>

                        {/* Render Books on Top Shelf */}
                        {books.length > 0 && topShelfBooks.map((layout, i) => {
                            if (i >= books.length) return null;
                            let bookObj = books[i];
                            if (!bookObj) return null;

                            const shelfTopY = 0.78;
                            const height = layout.size[1];
                            const overhang = 0.016;
                            const thickness = layout.size[0];
                            const isFlat = Math.abs(layout.rot[0]) > 1.0;

                            let computedY = shelfTopY + (height / 2) + overhang + 0.01;
                            if (isFlat) {
                                computedY = layout.pos[1] + 0.01;
                            } else if (Math.abs(layout.rot[2]) > 0.05) {
                                const tiltDip = Math.sin(Math.abs(layout.rot[2])) * (thickness / 2);
                                computedY += tiltDip;
                            }

                            return (
                                <BookMesh
                                    key={`top-${i}`}
                                    book={bookObj}
                                    position={[layout.pos[0], computedY, layout.pos[2]]}
                                    rotation={layout.rot as [number, number, number]}
                                    dimensions={layout.size as [number, number, number]}
                                    onSelect={() => onSelectBook(bookObj)}
                                    onPreview={() => onPreviewBook(bookObj)}
                                    isTransitioning={isTransitioning}
                                    setIsTransitioning={setIsTransitioning}
                                    isActive={selectedBook?.id === bookObj.id}
                                    isFlipped={isFlipped}
                                    onReadBook={() => onReadBook && onReadBook(bookObj)}
                                />
                            );
                        })}

                        {/* BOTTOM SHELF WOOD */}
                        <mesh position={[0, -1.1, -0.05]} castShadow receiveShadow>
                            <boxGeometry args={[6.5, 0.12, 0.9]} />
                            <meshStandardMaterial
                                color="#8a5c38"
                                roughness={0.7}
                                metalness={0.15}
                            />
                        </mesh>

                        {/* Render Books on Bottom Shelf */}
                        {books.length > 0 && bottomShelfBooks.map((layout, i) => {
                            const idx = topShelfBooks.length + i;
                            if (idx >= books.length) return null;
                            let bookObj = books[idx];
                            if (!bookObj) return null;

                            const shelfTopY = -1.04;
                            const height = layout.size[1];
                            const overhang = 0.016;
                            const thickness = layout.size[0];
                            const isFlat = Math.abs(layout.rot[0]) > 1.0;

                            let computedY = shelfTopY + (height / 2) + overhang + 0.01;
                            if (isFlat) {
                                const flatBooks = bottomShelfBooks.filter(b => b.pos[0] === layout.pos[0] && Math.abs(b.rot[0]) > 1.0);
                                const stackIndex = flatBooks.findIndex(b => b.size[1] === layout.size[1]);
                                const coverThickness = 0.012;

                                if (stackIndex === 0) {
                                    computedY = shelfTopY + (thickness / 2) + coverThickness + 0.01;
                                } else if (stackIndex === 1) {
                                    const baseThickness = flatBooks[0].size[0];
                                    computedY = shelfTopY + baseThickness + (coverThickness * 2) + (thickness / 2) + coverThickness + 0.01;
                                } else {
                                    const baseThickness = flatBooks[0].size[0];
                                    const middleThickness = flatBooks[1].size[0];
                                    computedY = shelfTopY + baseThickness + middleThickness + (coverThickness * 4) + (thickness / 2) + coverThickness + 0.01;
                                }
                            } else if (Math.abs(layout.rot[2]) > 0.05) {
                                const tiltDip = Math.sin(Math.abs(layout.rot[2])) * (thickness / 2);
                                computedY += tiltDip;
                            }

                            return (
                                <BookMesh
                                    key={`bottom-${i}`}
                                    book={bookObj}
                                    position={[layout.pos[0], computedY, layout.pos[2]]}
                                    rotation={layout.rot as [number, number, number]}
                                    dimensions={layout.size as [number, number, number]}
                                    onSelect={() => onSelectBook(bookObj)}
                                    onPreview={() => onPreviewBook(bookObj)}
                                    isTransitioning={isTransitioning}
                                    setIsTransitioning={setIsTransitioning}
                                    isActive={selectedBook?.id === bookObj.id}
                                    isFlipped={isFlipped}
                                    onReadBook={() => onReadBook && onReadBook(bookObj)}
                                />
                            );
                        })}


                    </group>
                </Center>

                <CameraController controlsRef={controlsRef} />
                <SearchCameraFocus controlsRef={controlsRef} isSearchActive={isSearchActive} aspect={aspect} />

                <OrbitControls
                    ref={controlsRef}
                    enableRotate={false}
                    enableZoom={!isTransitioning}
                    minDistance={2.5}
                    maxDistance={5.5}
                    enablePan={!isTransitioning}
                    panSpeed={1.8}
                    screenSpacePanning={true}
                    mouseButtons={{
                        LEFT: THREE.MOUSE.PAN,
                        MIDDLE: THREE.MOUSE.DOLLY,
                        RIGHT: THREE.MOUSE.ROTATE
                    }}
                    touches={{
                        ONE: THREE.TOUCH.PAN,
                        TWO: THREE.TOUCH.DOLLY_PAN
                    }}
                />
            </Canvas>
        </div>
    );
};
