import pytest

from app.modules.pre.scale import scale_from_points, scale_from_ratio


def test_ratio_scale():
    # 1:100 at 150 DPI: one render pixel is 0.0254 / 150 m on paper, times 100
    assert scale_from_ratio(100) == pytest.approx(0.0169333, rel=1e-5)


def test_ratio_scale_rejects_zero():
    with pytest.raises(ValueError):
        scale_from_ratio(0)


def test_points_scale():
    assert scale_from_points((0, 0), (300, 400), 5.0) == pytest.approx(0.01)


@pytest.mark.parametrize(
    "args",
    [((0, 0), (0, 0.5), 5.0), ((0, 0), (10, 0), 0), ((0, 0), (10, 0), -1)],
)
def test_points_scale_rejects(args):
    with pytest.raises(ValueError):
        scale_from_points(*args)
